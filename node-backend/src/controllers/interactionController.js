const { callMl } = require('../services/mlService');

const ALLOWED_ACTIONS = new Set(['upvote', 'downvote', 'save', 'share']);

// POST /api/interact : log an interaction and update user vector
async function interact(req, res, next) {
  const userId = Number(req.body?.userId);
  const articleId = Number(req.body?.articleId);
  const action = String(req.body?.action || '').toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(articleId) || articleId <= 0 || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'userId, articleId, and a valid action are required.' });
  }

  try {
    await callMl('/interact', { user_id: userId, article_id: articleId, action });
    res.status(204).end(); // No content
  } catch (error) {
    next(error);
  }
}

// POST /api/explain : "Why am I seeing this article?" — returns a human-readable
// explanation of why the given article was recommended to this user.
// This is the endpoint the frontend button should call.
async function explain(req, res, next) {
  const userId = Number(req.body?.userId);
  const articleId = Number(req.body?.articleId);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(articleId) || articleId <= 0) {
    return res.status(400).json({ error: 'A valid userId and articleId are required.' });
  }

  try {
    const explanation = await callMl('/explain', { user_id: userId, article_id: articleId });
    res.json(explanation);
  } catch (error) {
    next(error);
  }
}

module.exports = { interact, explain };
