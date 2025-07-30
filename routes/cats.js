const express = require('express');
const router = express.Router();
const DB = require('../db');

// GET /api/cats — list all player cats
router.get('/', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM player_cats');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cats — create a player cat
router.post('/', async (req, res) => {
  const { player_id, name, breed, variant, palette, description } = req.body;

  if (!player_id || !name || !breed || !variant || !palette) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await DB.query(
      `INSERT INTO player_cats
       (player_id, name, breed, variant, palette, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [player_id, name, breed, variant, palette, description]
    );

    res.status(201).json({ message: 'Cat created!', cat: result.rows[0] });
  } catch (error) {
    console.error('Error inserting cat:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/cats/:id — update a cat
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, breed, variant, palette, description } = req.body;

  if (!name || !breed || !variant || !palette) {
    return res.status(400).json({ error: 'Missing updated cat fields' });
  }

  try {
    const result = await DB.query(
      `UPDATE player_cats
       SET name = $1, breed = $2, variant = $3, palette = $4, description = $5
       WHERE id = $6
       RETURNING *`,
      [name, breed, variant, palette, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cat not found' });
    }

    res.status(200).json({ message: 'Cat updated', cat: result.rows[0] });
  } catch (error) {
    console.error('Error updating cat:', error);
    res.status(500).json({ error: 'Server error while updating cat' });
  }
});

// DELETE /api/cats/:id — delete a cat
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await DB.query(
      'DELETE FROM player_cats WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cat not found' });
    }

    res.status(200).json({ message: 'Cat deleted successfully', cat: result.rows[0] });
  } catch (error) {
    console.error('Error deleting cat:', error);
    res.status(500).json({ error: 'Server error while deleting cat' });
  }
});

module.exports = router;
