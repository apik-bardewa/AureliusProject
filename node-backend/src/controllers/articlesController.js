const { dbAll } = require('../db');
const { callMl } = require('../services/mlService');
const { attachImages } = require('../services/wikiImageService');
const { validIdList } = require('../utils/validators');
const { STARTER_ARTICLE_IDS } = require('../config');

// GET /api/onboarding/articles : returns a static set of starter articles for the first load
async function getOnboardingArticles(_req, res, next) {
  try {
    const placeholders = STARTER_ARTICLE_IDS.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT id, title, first_two_sentences, category, wiki_link
       FROM pages WHERE id IN (${placeholders})`,
      STARTER_ARTICLE_IDS,
    );
    // Preserve the original order
    const order = new Map(STARTER_ARTICLE_IDS.map((id, index) => [id, index]));
    rows.sort((a, b) => order.get(a.id) - order.get(b.id));
    const enriched = await attachImages(rows);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
}

// POST /api/feed : get personalized article recommendations
async function getFeed(req, res, next) {
  const userId = Number(req.body?.userId);
  const seenIds = validIdList(req.body?.seenIds);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid userId is required. Complete onboarding first.' });
  }

  try {
    // Ask ML service for recommendations (article IDs)
    const recommendation = await callMl('/recommend', {
      user_id: userId,
      seen_ids: seenIds,
      limit: 20,
    });
    const articleIds = validIdList(recommendation.article_ids, 20);
    if (articleIds.length === 0) return res.json([]);

    // Fetch full article data from SQLite
    const placeholders = articleIds.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT id, title, first_two_sentences, category, wiki_link
       FROM pages WHERE id IN (${placeholders})`,
      articleIds,
    );
    // Reorder to match the sequence from ML
    const order = new Map(articleIds.map((id, index) => [id, index]));
    rows.sort((a, b) => order.get(a.id) - order.get(b.id));
    const enriched = await attachImages(rows);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
}

module.exports = { getOnboardingArticles, getFeed };
