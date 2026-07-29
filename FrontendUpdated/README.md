# Aurelius — Frontend

A React + Vite + Tailwind CSS client for the Aurelius recommendation system,
wired to the `server.js` / `main.py` backend.

## Setup

```bash
npm install
cp .env.example .env
# edit .env if your backend runs somewhere other than http://localhost:5000
npm run dev
```

The app runs at `http://localhost:5173`. Make sure your Node backend
(`server.js`, port 5000) and Python ML service (`main.py`, port 8000) are
already running.

## What's included

- **Auth**: `/signin`, `/signup` — calls `POST /api/signup` and
  `POST /api/login`, stores the returned JWT, and restores the session on
  reload via `GET /api/me`.
- **Onboarding**: right after signup (or for any account without a built
  profile yet), an interest picker calls `GET /api/onboarding/articles` and
  `POST /api/onboard` before the feed unlocks — the ML service needs at
  least one article/topic to build a starting vector.
- **Feed**: `POST /api/feed`, paginated with a "Show me more" button that
  extends the `seenIds` list sent to the backend.
- **Article actions**: upvote / downvote / bookmark / share all call
  `POST /api/interact`. **Comments are UI-only (disabled)** — the backend
  has no comment endpoint yet, so the button is present but inert with a
  "coming soon" tooltip, rather than silently pretending to work.
- **"Why am I seeing this?"**: the triple-dot menu on each card opens a
  panel that calls `POST /api/explain` and renders the affinity score,
  matched category, and the liked articles it was based on.
- **Bookmarks page**: calls `GET /api/bookmarks` (added to `server.js`) to
  list saved articles — the original backend logged saves but had no way to
  read them back, so this one small addition was necessary for the "view
  bookmarks" sidebar item to actually work.
- **Dark/light mode**: toggle lives in the fixed Navbar (left, next to the
  logo) and is repeated in Settings; persisted to `localStorage`.
- **Layout**: fixed `Navbar` (logo + theme toggle on the left, user profile
  menu on the right) with a persistent left `Sidebar` (Home feed, Saved
  articles, Settings, Log out) — the feed itself only occupies the
  remaining central column, not the full screen width.

## Known gaps (backend limitations, not bugs)

- No "unsave" — clicking bookmark again re-logs a `save` interaction rather
  than removing it from the list (the backend only appends interaction
  rows; there's no delete/toggle endpoint).
- Comments have no backend support at all yet.
- `/api/onboard` is the only way to attach a vector profile; there's no way
  to *change* interests later without adding a new endpoint.
