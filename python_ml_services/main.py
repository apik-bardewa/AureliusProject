"""FastAPI recommendation service for Aurelius.

The corpus embeddings and FAISS index are precomputed assets.  This service
loads the index once, then owns vector profile creation, retrieval and Rocchio
feedback updates.
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import faiss
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --- Configuration & constants (loaded from environment or defaults) ---

# Default fallback paths point at your actual data folders, so you don't
# need to set AURELIUS_DATABASE_PATH / AURELIUS_INDEX_PATH every session.
# Override with the env vars if these ever move.
DEFAULT_DATABASE_PATH = r"C:\Users\LENOVO\Downloads\database\database.db"
DEFAULT_INDEX_PATH = r"C:\Users\LENOVO\Downloads\wiki_index\wiki_index.faiss"

DATABASE_PATH = Path(os.getenv("AURELIUS_DATABASE_PATH", DEFAULT_DATABASE_PATH))
INDEX_PATH = Path(os.getenv("AURELIUS_INDEX_PATH", DEFAULT_INDEX_PATH))

# Embedding dimensionality (fixed for all-MiniLM-L6-v2)
VECTOR_DIMENSION = 384

# Exploration probability (epsilon-greedy)
EPSILON = 0.15

# Rocchio feedback parameters (for updating user vector based on interactions)
LAMBDA = 0.95   # retention factor for old vector
BETA = 0.10     # positive feedback (upvote, save, share) boost
GAMMA = 0.05    # negative feedback (downvote) penalty

# "Why am I seeing this?" tuning
EXPLAIN_HISTORY_LIMIT = 200        # how many recent positive interactions to scan
EXPLAIN_TOP_SIMILAR = 3            # how many "because you liked X" articles to surface
EXPLAIN_HIGH_AFFINITY = 0.55       # cosine similarity considered a strong topical match
EXPLAIN_LOW_AFFINITY = 0.25        # below this, treat as diversity/exploration pick

# Global state: FAISS index and maximum page ID (for random exploration)
index: faiss.Index | None = None
max_page_id = 0

# Lazy-loaded SentenceTransformer model
text_model = None


# --- Pydantic models for request validation ---

class OnboardingRequest(BaseModel):
    article_ids: list[int] = Field(default_factory=list, max_length=20)
    topics: list[str] = Field(default_factory=list, max_length=20)
    user_id: int | None = Field(default=None, gt=0)


class RecommendationRequest(BaseModel):
    user_id: int = Field(gt=0)
    seen_ids: list[int] = Field(default_factory=list, max_length=10000)
    limit: int = Field(default=20, ge=1, le=50)


class InteractionRequest(BaseModel):
    user_id: int = Field(gt=0)
    article_id: int = Field(gt=0)
    action: Literal["upvote", "downvote", "save", "share"]


class EmbedRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class ExplainRequest(BaseModel):
    user_id: int = Field(gt=0)
    article_id: int = Field(gt=0)


# --- Database utilities ---

def connect() -> sqlite3.Connection:
    """Create a connection to the SQLite database with row factory set to sqlite3.Row."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialise_tables() -> None:
    """Ensure the users and interactions tables (and index) exist."""
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE,
                password_hash TEXT,
                name TEXT,
                vector TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                article_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(article_id) REFERENCES pages(id)
            );
            CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
            """
        )


# --- Lifespan context manager: loads assets at startup and cleans up on shutdown ---

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load FAISS index, verify DB and index exist, initialise tables, and store max_page_id."""
    global index, max_page_id

    # Validate existence of required files
    if not DATABASE_PATH.exists():
        raise RuntimeError(
            f"SQLite database was not found at {DATABASE_PATH}. "
            "Set the AURELIUS_DATABASE_PATH environment variable, or update "
            "DEFAULT_DATABASE_PATH in main.py, to point at your real database.db."
        )
    if not INDEX_PATH.exists():
        raise RuntimeError(
            f"FAISS index was not found at {INDEX_PATH}. "
            "Set the AURELIUS_INDEX_PATH environment variable, or update "
            "DEFAULT_INDEX_PATH in main.py, to point at your real wiki_index.faiss."
        )

    # Check the pages table exists before doing anything else with it —
    # gives a clear error instead of a raw sqlite3.OperationalError.
    with connect() as connection:
        pages_table = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pages'"
        ).fetchone()
        if pages_table is None:
            raise RuntimeError(
                f"No 'pages' table found in {DATABASE_PATH}. "
                "This database file doesn't contain your article data — double "
                "check AURELIUS_DATABASE_PATH points at the correct database.db."
            )

    # Ensure tables exist (for users and interactions)
    initialise_tables()

    # Load FAISS index into global variable
    index = faiss.read_index(str(INDEX_PATH))
    if index.d != VECTOR_DIMENSION:
        raise RuntimeError(f"Expected {VECTOR_DIMENSION}-dimensional FAISS vectors, found {index.d}")

    # Determine the maximum article ID (for random exploration)
    with connect() as connection:
        max_page_id = int(connection.execute("SELECT COALESCE(MAX(id), 0) FROM pages").fetchone()[0])

    # Warm up the text embedding model now (importing torch + loading
    # weights can take a while on the very first use). Doing it here means
    # the first real /onboard request with topics isn't the one that pays
    # for it — avoiding client-side timeouts.
    print("Warming up sentence-transformer model...")
    get_text_model()
    print("Model ready.")

    yield  # Service runs here

    # Cleanup: release index
    index = None


# --- FastAPI app instance ---

app = FastAPI(title="Aurelius ML Service", lifespan=lifespan)

# Configure CORS to allow frontend development servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Vector manipulation helpers ---

def parse_vector(value: str) -> np.ndarray:
    """Deserialize a JSON‑encoded vector string into a numpy array."""
    vector = np.asarray(json.loads(value), dtype=np.float32)
    if vector.shape != (VECTOR_DIMENSION,):
        raise ValueError("Stored embedding has an unexpected dimension.")
    return vector


def normalise(vector: np.ndarray) -> np.ndarray:
    """Normalize a vector to unit L2 norm. Raises ValueError for zero vector."""
    magnitude = float(np.linalg.norm(vector))
    if magnitude == 0:
        raise ValueError("Cannot normalise a zero-length user vector.")
    return (vector / magnitude).astype(np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors, safe against zero-length vectors."""
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def get_text_model():
    """Lazy-load the SentenceTransformer model (all-MiniLM-L6-v2)."""
    global text_model
    if text_model is None:
        from sentence_transformers import SentenceTransformer
        text_model = SentenceTransformer("all-MiniLM-L6-v2")
    return text_model


# --- Data retrieval from SQLite ---

def get_article_vectors(article_ids: list[int]) -> list[np.ndarray]:
    """Fetch embeddings for a list of article IDs from the pages table."""
    # Remove duplicates and invalid IDs
    ids = list(dict.fromkeys(article_id for article_id in article_ids if article_id > 0))
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    with connect() as connection:
        rows = connection.execute(
            f"SELECT id, embedding FROM pages WHERE id IN ({placeholders})", ids
        ).fetchall()
    # Parse each stored JSON vector into numpy array
    return [parse_vector(row["embedding"]) for row in rows]


def get_articles_meta(article_ids: list[int]) -> dict[int, dict]:
    """Fetch id/title/category for a list of article IDs, keyed by id."""
    ids = list(dict.fromkeys(article_id for article_id in article_ids if article_id > 0))
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    with connect() as connection:
        rows = connection.execute(
            f"SELECT id, title, category, embedding FROM pages WHERE id IN ({placeholders})", ids
        ).fetchall()
    meta: dict[int, dict] = {}
    for row in rows:
        try:
            vector = parse_vector(row["embedding"])
        except (ValueError, json.JSONDecodeError):
            vector = None
        meta[int(row["id"])] = {"id": int(row["id"]), "title": row["title"], "category": row["category"], "vector": vector}
    return meta


def get_topic_vectors(topics: list[str]) -> list[np.ndarray]:
    """Convert a list of topic strings into embedding vectors using the text model."""
    clean_topics = [topic.strip() for topic in topics if topic and topic.strip()]
    if not clean_topics:
        return []

    model = get_text_model()
    embeddings = model.encode(clean_topics, convert_to_numpy=True, normalize_embeddings=False)
    embeddings = np.atleast_2d(np.asarray(embeddings, dtype=np.float32))
    return [embedding for embedding in embeddings]


def build_initial_profile(article_ids: list[int], topics: list[str]) -> np.ndarray:
    """Combine article vectors and topic vectors, average them, and normalize."""
    vectors = get_article_vectors(article_ids) + get_topic_vectors(topics)
    if not vectors:
        raise HTTPException(status_code=400, detail="Provide at least one article or topic to begin.")
    return normalise(np.mean(np.stack(vectors), axis=0))


def get_user_vector(user_id: int) -> np.ndarray:
    """Retrieve and parse the stored vector for a given user."""
    with connect() as connection:
        row = connection.execute("SELECT vector FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User profile was not found. Complete onboarding first.")
    if row["vector"] is None:
        raise HTTPException(status_code=400, detail="This account hasn't completed onboarding yet.")
    try:
        return parse_vector(row["vector"])
    except (ValueError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="User profile vector is invalid.") from error


def get_recent_positive_interactions(user_id: int, limit: int = EXPLAIN_HISTORY_LIMIT) -> list[dict]:
    """Fetch the user's most recent upvote/save/share interactions."""
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT article_id, action, timestamp FROM interactions
            WHERE user_id = ? AND action IN ('upvote', 'save', 'share')
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [{"article_id": int(row["article_id"]), "action": row["action"], "timestamp": row["timestamp"]} for row in rows]


# --- Exploration & ranking strategies ---

def exploration_ids(seen: set[int], limit: int) -> list[int]:
    """Sample article IDs by primary key, aiming for category diversity without random SQL ordering.

    This repeatedly picks a random start ID and takes the next existing page,
    skipping seen IDs and trying to avoid repeated categories.
    """
    selected: list[int] = []
    categories: set[str] = set()
    attempts = 0
    with connect() as connection:
        while len(selected) < limit and attempts < limit * 40:
            attempts += 1
            start_id = random.randint(1, max_page_id)
            row = connection.execute(
                "SELECT id, category FROM pages WHERE id >= ? ORDER BY id LIMIT 1", (start_id,)
            ).fetchone()
            if row is None or row["id"] in seen or row["id"] in selected:
                continue
            category = row["category"] or ""
            # If we already have this category, allow it only after more attempts
            if category and category in categories and attempts < limit * 25:
                continue
            selected.append(int(row["id"]))
            if category:
                categories.add(category)
    return selected


def ranked_ids(vector: np.ndarray, seen: set[int], limit: int) -> list[int]:
    """Retrieve the nearest neighbor article IDs from FAISS index, filtering out seen ones."""
    if index is None:
        raise HTTPException(status_code=503, detail="FAISS index is still loading.")
    # Candidate pool larger than needed to compensate for already viewed articles
    candidate_count = min(max(100, limit * 15 + len(seen)), int(index.ntotal))
    _distances, candidate_ids = index.search(vector.reshape(1, -1), candidate_count)
    selected: list[int] = []
    for candidate_id in candidate_ids[0].tolist():
        article_id = int(candidate_id)
        if article_id > 0 and article_id not in seen and article_id not in selected:
            selected.append(article_id)
        if len(selected) == limit:
            return selected
    return selected


# --- FastAPI endpoints ---

@app.get("/health")
def health() -> dict[str, int | str]:
    """Health check endpoint; returns number of vectors in FAISS index."""
    return {"status": "ok", "vectors": int(index.ntotal) if index is not None else 0}


@app.post("/onboard")
def onboard(payload: OnboardingRequest) -> dict[str, int]:
    """Create or attach a recommendation profile from given article IDs and/or topics.

    The user vector is built by averaging and normalizing the provided vectors.
    If `user_id` is provided (a signed-up account), the vector is attached to
    that existing row. Otherwise a brand-new anonymous user row is created,
    preserving the original behaviour.
    """
    user_vector = build_initial_profile(payload.article_ids, payload.topics)
    vector_json = json.dumps(user_vector.tolist(), separators=(",", ":"))

    with connect() as connection:
        if payload.user_id is not None:
            existing = connection.execute(
                "SELECT id FROM users WHERE id = ?", (payload.user_id,)
            ).fetchone()
            if existing is None:
                raise HTTPException(status_code=404, detail="Account was not found. Sign up first.")
            connection.execute(
                "UPDATE users SET vector = ? WHERE id = ?",
                (vector_json, payload.user_id),
            )
            user_id = payload.user_id
        else:
            cursor = connection.execute(
                "INSERT INTO users (vector, created_at) VALUES (?, CURRENT_TIMESTAMP)",
                (vector_json,),
            )
            user_id = int(cursor.lastrowid)

    return {"user_id": user_id}


@app.post("/recommend")
def recommend(payload: RecommendationRequest) -> dict[str, list[int] | bool]:
    """Return a list of article IDs for a given user.

    Uses epsilon-greedy exploration: with probability EPSILON, return random
    exploration IDs; otherwise, return nearest neighbors from FAISS.
    If the initial result has fewer than the limit, it is padded with exploration IDs.
    """
    user_vector = get_user_vector(payload.user_id)
    seen = {article_id for article_id in payload.seen_ids if article_id > 0}
    is_exploring = random.random() < EPSILON
    article_ids = exploration_ids(seen, payload.limit) if is_exploring else ranked_ids(user_vector, seen, payload.limit)
    if len(article_ids) < payload.limit:
        # Pad with additional exploration items, avoiding duplicates
        article_ids.extend(exploration_ids(seen | set(article_ids), payload.limit - len(article_ids)))
    return {"article_ids": article_ids, "exploring": is_exploring}


@app.post("/interact")
def interact(payload: InteractionRequest) -> dict[str, str]:
    """Update user's vector based on an interaction (Rocchio feedback).

    For upvote/save/share: vector = LAMBDA*old + BETA*article
    For downvote: vector = LAMBDA*old - GAMMA*article
    Then normalize. Also logs the interaction.
    """
    old_vector = get_user_vector(payload.user_id)
    vectors = get_article_vectors([payload.article_id])
    if not vectors:
        raise HTTPException(status_code=404, detail="Article was not found.")

    article_vector = vectors[0]
    if payload.action == "downvote":
        new_vector = normalise(LAMBDA * old_vector - GAMMA * article_vector)
    else:
        new_vector = normalise(LAMBDA * old_vector + BETA * article_vector)

    with connect() as connection:
        connection.execute(
            "UPDATE users SET vector = ? WHERE id = ?",
            (json.dumps(new_vector.tolist(), separators=(",", ":")), payload.user_id),
        )
        connection.execute(
            "INSERT INTO interactions (user_id, article_id, action, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (payload.user_id, payload.article_id, payload.action),
        )
    return {"status": "updated"}


@app.post("/embed")
def embed(payload: EmbedRequest) -> dict[str, list[float]]:
    """Optional endpoint to embed arbitrary text using the same model (for demo)."""
    try:
        model = get_text_model()
        vector = model.encode(payload.text, normalize_embeddings=True)
    except Exception as error:  # pragma: no cover - depends on local model availability
        raise HTTPException(status_code=503, detail="MiniLM model is unavailable.") from error
    return {"vector": np.asarray(vector, dtype=np.float32).tolist()}


@app.post("/explain")
def explain(payload: ExplainRequest) -> dict:
    """Explain why a given article was (or would be) recommended to this user.

    Combines two signals:
      1. Overall affinity: cosine similarity between the user's profile vector
         and the article's embedding.
      2. Nearest liked articles: among the user's recent upvote/save/share
         interactions, which liked articles are most similar to this one.
    Also flags a shared category between the article and the user's liked history.
    """
    user_vector = get_user_vector(payload.user_id)

    article_meta = get_articles_meta([payload.article_id]).get(payload.article_id)
    if article_meta is None or article_meta["vector"] is None:
        raise HTTPException(status_code=404, detail="Article was not found.")

    article_vector = article_meta["vector"]
    affinity_score = cosine_similarity(user_vector, article_vector)

    # Look at the user's recent positive interactions and rank them by
    # similarity to the target article.
    history = get_recent_positive_interactions(payload.user_id)
    history_ids = [entry["article_id"] for entry in history]
    history_meta = get_articles_meta(history_ids)

    similarities: list[tuple[float, dict, str]] = []
    for entry in history:
        meta = history_meta.get(entry["article_id"])
        if meta is None or meta["vector"] is None or entry["article_id"] == payload.article_id:
            continue
        similarity = cosine_similarity(article_vector, meta["vector"])
        similarities.append((similarity, meta, entry["action"]))

    similarities.sort(key=lambda item: item[0], reverse=True)
    top_similar = similarities[:EXPLAIN_TOP_SIMILAR]

    based_on = [
        {
            "id": meta["id"],
            "title": meta["title"],
            "action": action,
            "similarity": round(similarity, 3),
        }
        for similarity, meta, action in top_similar
        if similarity > 0
    ]

    # Category overlap with the user's liked history
    liked_categories = {meta["category"] for _, meta, _ in similarities if meta["category"]}
    matched_category = article_meta["category"] if article_meta["category"] in liked_categories else None

    # Build a human-readable explanation
    reasons: list[str] = []
    if based_on:
        titles = ", ".join(item["title"] for item in based_on)
        reasons.append(f"It's similar to articles you previously liked: {titles}.")
    if matched_category:
        reasons.append(f"It falls under \"{matched_category}\", a category you've engaged with before.")
    if affinity_score >= EXPLAIN_HIGH_AFFINITY:
        reasons.append("It closely matches your overall interests based on your reading history.")
    elif affinity_score <= EXPLAIN_LOW_AFFINITY:
        reasons.append("It's a bit outside your usual interests — we occasionally surface new topics to help you discover something different.")
    else:
        reasons.append("It's moderately related to topics you've shown interest in.")

    explanation_text = " ".join(reasons)

    return {
        "article_id": article_meta["id"],
        "title": article_meta["title"],
        "affinity_score": round(affinity_score, 3),
        "matched_category": matched_category,
        "based_on": based_on,
        "explanation": explanation_text,
    }