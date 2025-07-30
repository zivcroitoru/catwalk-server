const express = require('express');
const router = express.Router();
const DB = require('../db');

// GET /api/cat-templates — public game catalog
router.get('/api/cat-templates', async (_req, res) => {
  try {
    const { rows } = await DB.query('SELECT * FROM cat_templates');
    const grouped = {};

    rows.forEach(cat => {
      const breed = cat.breed;
      if (!grouped[breed]) grouped[breed] = [];

      grouped[breed].push({
        name: cat.name,
        variant: cat.variant,
        palette: cat.palette,
        sprite: cat.sprite_url
      });
    });

    res.json(grouped);
  } catch (err) {
    console.error('cat-templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

module.exports = router;
