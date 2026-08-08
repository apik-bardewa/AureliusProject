const express = require('express');
const { interact, explain } = require('../controllers/interactionController');

const router = express.Router();

router.post('/interact', interact);
router.post('/explain', explain);

module.exports = router;
