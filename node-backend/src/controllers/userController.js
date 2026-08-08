const { dbAll } = require('../db');

// GET /api/users/:userId : check if user exists
async function getUser(req, res, next) {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid userId is required.' });
  }

  try {
    const rows = await dbAll('SELECT id FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User profile was not found.' });
    }
    res.json({ exists: true, userId });
  } catch (error) {
    next(error);
  }
}

module.exports = { getUser };
