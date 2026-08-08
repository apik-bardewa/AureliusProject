const express = require('express');

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const articleRoutes = require('./articleRoutes');
const onboardRoutes = require('./onboardRoutes');
const interactionRoutes = require('./interactionRoutes');
const bookmarkRoutes = require('./bookmarkRoutes');
const healthRoutes = require('./healthRoutes');

const router = express.Router();

router.use(authRoutes);
router.use(userRoutes);
router.use(articleRoutes);
router.use(onboardRoutes);
router.use(interactionRoutes);
router.use(bookmarkRoutes);
router.use(healthRoutes);

module.exports = router;
