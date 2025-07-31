// routes/userItems.js
import express from 'express';
import DB from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// JWT middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/user-items
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await DB.query(
      'SELECT userCats, coins FROM user_items WHERE user_id = $1',
      [userId]
    );

    const { usercats = [], coins = 0 } = result.rows[0] || {};
    res.json({ userCats: usercats, coins });
  } catch (err) {
    console.error('❌ GET /user-items error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/user-items
router.patch('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { userCats = [], coins = 0 } = req.body;

  try {
    await DB.query(`
      INSERT INTO user_items (user_id, userCats, coins)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id)
      DO UPDATE SET userCats = $2, coins = $3
    `, [userId, JSON.stringify(userCats), coins]);

    res.json({ userCats, coins });
  } catch (err) {
    console.error('❌ PATCH /user-items error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
