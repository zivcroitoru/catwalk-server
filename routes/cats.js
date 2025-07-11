const express = require('express'); //import express framework
const router = express.Router(); //create a new router
const DB = require('../db');


//list all the cats ^.,.^
router.get('/', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM cats');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST a new cat ≽^•⩊•^≼
router.post('/', async (req, res) => {
  const { id, player_id, name, breed, variant, palette, description, created_at } = req.body; //correct

 if (!id|| !player_id || !name || !breed || !variant || !palette) {
    return res.status(400).json({ error: 'Missing required fields' });
  }


  try {
    const result = await DB.query(
      `INSERT INTO cats 
       (id, player_id, name, breed, variant, palette, description, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [id, player_id, name, breed, variant, palette, description, created_at]
    );

    res.status(201).json({ message: 'Cat created!', cat: result.rows[0] });
  } catch (error) {
    console.error('Error inserting cat:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update a cat ฅ^•ﻌ•^ฅ
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, breed, variant, palette, description } = req.body;

  if (!name || !breed || !variant || !palette || description) {
    return res.status(400).json({ error: 'Missing updated cat fields' });
  }

  try {
    const result = await DB.query(
      `UPDATE cats
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

// DELETE a cat ^. .^₎Ⳋ
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await DB.query(
      'DELETE FROM cats WHERE id = $1 RETURNING *',
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