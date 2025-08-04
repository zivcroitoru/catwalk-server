// routes/cat_items.js
import express from 'express';
import DB from '../db.js';

const router = express.Router();

// ───────────── PATCH: Update Cat Equipment ─────────────
router.patch('/:catId', async (req, res) => {
  const catId = parseInt(req.params.catId);
  const { equipment } = req.body;

  console.log('Incoming PATCH /cat_items:', { catId, equipment });

  if (!equipment || typeof equipment !== 'object') {
    console.log('Invalid equipment');
    return res.status(400).json({ error: 'Missing or invalid equipment' });
  }

  try {
    const result = await DB.query(
      `SELECT player_id FROM player_cats WHERE cat_id = $1`,
      [catId]
    );

    if (result.rows.length === 0) {
      console.log('No cat found for ID:', catId);
      return res.status(404).json({ error: 'Cat not found' });
    }

    const player_id = result.rows[0].player_id;

    const categoryMap = {
      hat: 'hats',
      top: 'tops',
      eyes: 'eyes',
      accessories: 'accessories'
    };

    for (const [rawKey, template] of Object.entries(equipment)) {
      const category = categoryMap[rawKey]; 

      console.log('Processing:', { rawKey, category, template });

      if (!category || !template || typeof template !== 'string') {
        console.log(`Skipping invalid input:`, { rawKey, template });
        continue;
      }

      await DB.query(
        `INSERT INTO cat_items (cat_id, player_id, category, template)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cat_id, category)
         DO UPDATE SET template = EXCLUDED.template`,
        [catId, player_id, category, template]
      );
    }

    console.log(`Updated equipment for cat ${catId}`);
    res.status(200).json({ success: true, catId, equipment });
  } catch (error) {
    console.error('DB ERROR during PATCH:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ───────────── GET: Get Cat Equipment ─────────────
router.get('/:catId', async (req, res) => {
  const catId = parseInt(req.params.catId);

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
    console.error('Failed to fetch equipment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
