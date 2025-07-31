import express from 'express';
import DB from '../db.js';

const router = express.Router();



// ✅ NEW: public route for client to fetch all shop items
router.get('/shop-items', async (_req, res) => {
  try {
    const { rows } = await DB.query(`
      SELECT 
        template,
        name,
        price,
        sprite_url_preview,
        itemcategory.category_name AS category
      FROM itemtemplate
      JOIN itemcategory ON itemtemplate.category = itemcategory.category_name
    `);
    res.json(rows);
  } catch (e) {
    console.error('shop-items:', e);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

// get all items from shop table
router.get('/allclothes', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM itemtemplate');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// GET shop items (admin panel)
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
router.post('/', async (req, res) => {
  const { item_name, description, price, type } = req.body;

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

// PATCH /api/shop/edit/:id
router.patch('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { sprite_url_preview } = req.body;

  if (!sprite_url_preview) {
    return res.status(400).json({ error: 'Missing sprite_url_preview in request body' });
  }

  try {
    const result = await DB.query(
      `UPDATE itemtemplate
       SET sprite_url_preview = $1,
           last_updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2
       RETURNING *;`,
      [sprite_url_preview, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.status(200).json({ message: 'Item updated successfully', item: result.rows[0] });
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Server error while updating item' });
  }
});

//test
router.get('/test', async (req, res) => {
  try {
    const result = await DB.query('SELECT COUNT(*) FROM itemtemplate');
    res.status(200).json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({ error: 'Test query failed' });
  }
});


// GET shop item by template (primary key)
router.get('/:template', async (req, res) => {
  const { template } = req.params;

  try {
    const result = await DB.query(
      'SELECT * FROM itemtemplate WHERE template = $1',
      [template]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found with given template' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching item by template:', error);
    res.status(500).json({ error: 'Server error while fetching item' });
  }
});


// POST /api/shop/clothesadd
// Add new clothing item
router.post('/clothesadd', async (req, res) => {
  const {
    template,
    name,
    category,
    price,
    description,
    preview,
    sprite_url
  } = req.body;

  // Basic validation
  if (!template || !name || !category || !price || !description || !preview || !sprite_url) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await DB.query(
      `INSERT INTO clothes 
        (template, name, category, price, description, preview, sprite_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [template, name, category, price, description, preview, sprite_url]
    );

    res.status(201).json({
      message: "Clothing item added successfully",
      clothes: result.rows[0]
    });

  } catch (err) {
    console.error("Error inserting clothes:", err);
    res.status(500).json({ error: "Server error" });
  }
});



export default router;