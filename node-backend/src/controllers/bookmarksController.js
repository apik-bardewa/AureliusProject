const { dbAll, dbRun } = require('../db');
const { attachImages } = require('../services/wikiImageService');

// GET /api/bookmarks : list the logged-in user's saved (bookmarked) articles,
// most recently saved first. Requires an Authorization: Bearer <token> header.
// An article only appears here if its MOST RECENT save/unsave action for this
// user is 'save' — so removing then re-saving the same article works correctly.
async function listBookmarks(req, res, next) {
  try {
    const rows = await dbAll(
      `SELECT p.id, p.title, p.first_two_sentences, p.category, p.wiki_link, latest.saved_at
       FROM (
         SELECT article_id, action, timestamp AS saved_at,
                ROW_NUMBER() OVER (
                  PARTITION BY article_id
                  ORDER BY timestamp DESC, id DESC
                ) AS rn
         FROM interactions
         WHERE user_id = ? AND action IN ('save', 'unsave')
       ) latest
       JOIN pages p ON p.id = latest.article_id
       WHERE latest.rn = 1 AND latest.action = 'save'
       ORDER BY latest.saved_at DESC`,
      [req.userId],
    );
    const enriched = await attachImages(rows);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/bookmarks/:articleId : remove an article from saved/bookmarks.
// Logs an 'unsave' interaction rather than deleting history — this is a
// Node-only, append-only log entry; it intentionally does NOT call the ML
// service, since removing a bookmark shouldn't reverse the profile-vector
// nudge a "save" gave it (that's a deliberate simplification, not a bug —
// see the "known limitations" doc if this ever needs revisiting).
async function removeBookmark(req, res, next) {
  const articleId = Number(req.params.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return res.status(400).json({ error: 'A valid articleId is required.' });
  }

  try {
    await dbRun(
      'INSERT INTO interactions (user_id, article_id, action, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [req.userId, articleId, 'unsave'],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { listBookmarks, removeBookmark };
