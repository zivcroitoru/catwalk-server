import express from 'express';
import DB from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// JWT Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/user-items
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id; // Get user ID from JWT payload

  try {
    // Get all items for the user
    const result = await DB.query(`
      SELECT 
        pi.player_item_id,
        pi.template,
        it.name,
        it.category,
        it.sprite_url_preview
      FROM player_items pi
      JOIN itemtemplate it ON pi.template = it.template
      WHERE pi.player_id = $1
    `, [userId]);

    // Format response to match frontend expectations
    const response = {
      ownedItems: result.rows.map(item => item.template),
      itemDetails: result.rows.reduce((acc, item) => {
        acc[item.template] = {
          id: item.player_item_id,
          name: item.name,
          category: item.category,
          sprite_url_preview: item.sprite_url_preview
        };
        return acc;
      }, {})
    };

    res.json(response);
  } catch (err) {
    console.error('❌ Failed to fetch player items:', err.message);
    res.status(500).json({ error: 'Failed to fetch player items' });
  }
});

export default router;