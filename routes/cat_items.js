import express from 'express';
import DB from '../db.js'; // Make sure this is imported
const router = express.Router();

// PATCH /api/cat_items/:catId
router.patch('/:catId', async (req, res) => {
  const { catId } = req.params;
  const { equipment } = req.body; // e.g. { hats: "jester_hat_001", tops: "wizard_robe_002" }

  if (!equipment || typeof equipment !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid equipment' });
  }

  try {
    for (const [category, template] of Object.entries(equipment)) {
      await DB.query(
        `INSERT INTO cat_items (cat_id, category, template)
         VALUES ($1, $2, $3)
         ON CONFLICT (cat_id, category)
         DO UPDATE SET template = EXCLUDED.template`,
        [catId, category, template]
      );
    }

    console.log(`💾 Updated equipment for cat ${catId}:`, equipment);
    res.status(200).json({ success: true, catId, equipment });
  } catch (error) {
    console.error('❌ Failed to update cat_items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
