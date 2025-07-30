const express = require('express');
const router = express.Router();
const DB = require('../db');

// GET /api/user-items
router.get('/user-items', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const result = await DB.query(
      'SELECT * FROM player_items WHERE player_id = $1',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Failed to fetch player items:', err.message);
    res.status(500).json({ error: 'Failed to fetch player items' });
  }
});

module.exports = router;
