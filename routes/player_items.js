import express from 'express';
import DB from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ───────────── JWT Middleware ─────────────
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

// ───────────── GET /api/player_items ─────────────
router.get('/', requireAuth, async (req, res) => {
  const playerId = req.user.id;

  try {
    const result = await DB.query(
      'SELECT * FROM "player_items" WHERE player_id = $1',
      [playerId]
    );
    res.status(200).json({ items: result.rows });
  } catch (err) {
    console.error('❌ GET /player_items error:', err.stack || err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── PATCH /api/player_items ─────────────
router.patch('/', requireAuth, async (req, res) => {
  const playerId = req.user.id;
  const { template } = req.body;

  if (!template) {
    return res.status(400).json({ error: 'Missing template value' });
  }

  try {
    const itemResult = await DB.query(
      'SELECT price FROM itemtemplates WHERE template = $1',
      [template]
    );

    if (itemResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid item template' });
    }

    const price = itemResult.rows[0].price;

    const updateResult = await DB.query(
      `UPDATE players
       SET coins = coins - $1
       WHERE id = $2 AND coins >= $1
       RETURNING coins`,
      [price, playerId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(400).json({ error: 'Not enough coins' });
    }

    const insertResult = await DB.query(
      `INSERT INTO "player_items" (player_id, template)
       VALUES ($1, $2)
       RETURNING *`,
      [playerId, template]
    );

    res.status(200).json({
      message: 'Item added',
      item: insertResult.rows[0],
      coins: updateResult.rows[0].coins
    });
  } catch (err) {
    console.error('❌ PATCH /player_items error:', err.stack || err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
