const express = require('express');
const router = express.Router();
const DB = require('../db');

// GET /api/user-items
router.get('/', async (req, res) => {   // <--- path is now "/"
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const result = await DB.query(
      'SELECT * FROM player_items WHERE player_id = $1',
      [userId]
    );

    // You may want to shape this to fit what your frontend expects!
    res.json(result.rows[0] || {}); // send an object, not array, for empty
  } catch (err) {
    console.error('❌ Failed to fetch player items:', err.message);
    res.status(500).json({ error: 'Failed to fetch player items' });
  }
});

module.exports = router;
