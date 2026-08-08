const express = require('express');
const { listBookmarks, removeBookmark } = require('../controllers/bookmarksController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/bookmarks', requireAuth, listBookmarks);
router.delete('/bookmarks/:articleId', requireAuth, removeBookmark);

module.exports = router;
