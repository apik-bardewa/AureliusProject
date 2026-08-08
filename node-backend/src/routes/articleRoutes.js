const express = require('express');
const { getOnboardingArticles, getFeed } = require('../controllers/articlesController');

const router = express.Router();

router.get('/onboarding/articles', getOnboardingArticles);
router.post('/feed', getFeed);

module.exports = router;
