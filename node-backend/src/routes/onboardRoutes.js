const express = require('express');
const { onboard } = require('../controllers/onboardController');
const { attachUserIfPresent } = require('../middleware/auth');

const router = express.Router();

router.post('/onboard', attachUserIfPresent, onboard);

module.exports = router;
