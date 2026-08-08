// --- Wikipedia image enrichment ---
// The `pages` table has no image column, so we fetch each article's real
// thumbnail directly from Wikipedia's public REST summary API and attach it
// as `image_url` before sending the article list to the frontend. Results
// are cached in memory for the life of the process (an article's real
// Wikipedia image essentially never changes), so this only pays the network
// cost once per article, ever — not once per request.

const imageCache = new Map(); // article id -> string | null

function extractSummaryUrl(wikiLink) {
  try {
    const url = new URL(wikiLink);
    const title = url.pathname.replace(/^\/wiki\//, '');
    if (!title) return null;
    return `${url.origin}/api/rest_v1/page/summary/${title}`;
  } catch (_error) {
    return null;
  }
}

async function fetchThumbnail(article) {
  if (imageCache.has(article.id)) return imageCache.get(article.id);

  const summaryUrl = extractSummaryUrl(article.wiki_link);
  if (!summaryUrl) {
    imageCache.set(article.id, null);
    return null;
  }

  try {
    const response = await fetch(summaryUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      imageCache.set(article.id, null);
      return null;
    }
    const data = await response.json();
    const url = data?.thumbnail?.source || null;
    imageCache.set(article.id, url);
    return url;
  } catch (_error) {
    imageCache.set(article.id, null);
    return null;
  }
}

// Attaches `image_url` (string or null) to every row in the array, fetching
// in parallel. Never throws — a failed lookup just becomes `image_url: null`
// so the frontend can fall back to its own placeholder.
async function attachImages(rows) {
  const urls = await Promise.all(rows.map((row) => fetchThumbnail(row)));
  return rows.map((row, index) => ({ ...row, image_url: urls[index] }));
}

module.exports = { attachImages };
