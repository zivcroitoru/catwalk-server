// routes/cat_items.js
import express from 'express';
import DB from '../db.js';

const router = express.Router();

// ───────────── PATCH: Update Cat Equipment ─────────────
// PATCH /api/cat_items/:catId
router.patch('/:catId', async (req, res) => {
  const { catId } = req.params;
  const { equipment } = req.body;

  if (!equipment || typeof equipment !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid equipment' });
  }

  try {
    // Get player_id from player_cats
    const result = await DB.query(
      `SELECT player_id FROM player_cats WHERE cat_id = $1`,
      [catId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cat not found' });
    }

    const player_id = result.rows[0].player_id;

    for (const [category, template] of Object.entries(equipment)) {
      await DB.query(
        `INSERT INTO cat_items (cat_id, player_id, category, template)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cat_id, category)
         DO UPDATE SET template = EXCLUDED.template`,
        [catId, player_id, category, template]
      );
    }

    console.log(`💾 Updated equipment for cat ${catId}:`, equipment);
    res.status(200).json({ success: true, catId, equipment });
  } catch (error) {
    console.error('❌ Failed to update cat_items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ───────────── GET: Get Cat Equipment ─────────────
// GET /api/cat_items/:catId
router.get('/:catId', async (req, res) => {
  const { catId } = req.params;

  try {
    const result = await DB.query(
      `SELECT category, template FROM cat_items WHERE cat_id = $1`,
      [catId]
    );

    const equipment = {};
    result.rows.forEach(row => {
      equipment[row.category] = row.template;
    });

    res.status(200).json({ catId, equipment });
  } catch (error) {
    console.error('❌ Failed to fetch equipment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
