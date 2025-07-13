const express = require('express');
const router = express.Router();
const DB = require('../db');

// GET shop items
router.get('/', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM shop');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Server error while fetching shop items' });
  }
});

// POST new shop item
// POST a new shop item
router.post('/', async (req, res) => {
  const { item_name, description, price, type } = req.body;

  // Validate input
  if (!item_name || !description || !price || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await DB.query(
      `INSERT INTO shop (item_name, description, price, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [item_name, description, price, type]
    );

    res.status(201).json({ message: 'Item added to shop!', item: result.rows[0] });
  } catch (error) {
    console.error('Error inserting shop item:', error);
    res.status(500).json({ error: 'Server error while adding item' });
  }
});


// PUT update a shop item
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { item_name, description, price, type } = req.body;

  if (!item_name || !description || !price || !type) {
    return res.status(400).json({ error: 'Missing required fields for update' });
  }

  try {
    const result = await DB.query(
      `UPDATE shop
       SET item_name = $1, description = $2, price = $3, type = $4
       WHERE id = $5
       RETURNING *`,
      [item_name, description, price, type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shop item not found' });
    }

    res.status(200).json({ message: 'Shop item updated', item: result.rows[0] });
  } catch (error) {
    console.error('Error updating shop item:', error);
    res.status(500).json({ error: 'Server error while updating item' });
  }
});


// DELETE a shop item
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await DB.query(
      'DELETE FROM shop WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shop item not found' });
    }

    res.status(200).json({ message: 'Shop item deleted successfully', item: result.rows[0] });
  } catch (error) {
    console.error('Error deleting shop item:', error);
    res.status(500).json({ error: 'Server error while deleting item' });
  }
});

module.exports = router;
