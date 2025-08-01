// routes/cat_items.js
import express from 'express';
const router = express.Router();

// PATCH /api/cat_items/:catId
router.patch('/:catId', async (req, res) => {
  const { catId } = req.params;
  const { equipment } = req.body;

  if (!equipment) {
    return res.status(400).json({ error: 'Missing equipment' });
  }

  try {
    // TODO: Save equipment to DB
    console.log(`💾 Updating equipment for cat ${catId}:`, equipment);
    res.status(200).json({ success: true, catId, equipment });
  } catch (error) {
    console.error('❌ Failed to update cat_items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
