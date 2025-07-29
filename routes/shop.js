import express from 'express';
import DB from '../db.js';

const router = express.Router();



// GET shop items
router.get('/', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM itemtemplate');
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
      `INSERT INTO itemtemplate (name, description, price, category)
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
      `UPDATE itemtemplate
       SET  description = $1, price = $2, type = $3
       WHERE name = $4
       RETURNING *`,
      [item_name, description, price, type]
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
      'DELETE FROM itemtemplate WHERE name = $1 RETURNING *',
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


router.get('/test', async (req, res) => {
  try {
    const result = await DB.query('SELECT COUNT(*) FROM itemtemplate');
    res.status(200).json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({ error: 'Test query failed' });
  }
});




export default router;