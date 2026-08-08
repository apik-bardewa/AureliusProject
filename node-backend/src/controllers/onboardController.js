const { callMl } = require('../services/mlService');
const { validIdList, validTopicList } = require('../utils/validators');

// POST /api/onboard : create/attach a recommendation profile via the ML service.
// If the request carries a valid Authorization token, the profile is linked to
// that logged-in account. Otherwise it falls back to the old anonymous flow.
async function onboard(req, res, next) {
  const articleIds = validIdList(req.body?.articleIds, 20);
  const topics = validTopicList(req.body?.topics, 20);
  if (articleIds.length === 0 && topics.length === 0) {
    return res.status(400).json({ error: 'Select at least one article or topic to start your feed.' });
  }

  try {
    const mlPayload = { article_ids: articleIds, topics };
    if (req.userId) {
      mlPayload.user_id = req.userId;
    }
    const profile = await callMl('/onboard', mlPayload);
    res.status(201).json({ userId: profile.user_id ?? profile.userId });
  } catch (error) {
    next(error);
  }
}

module.exports = { onboard };
