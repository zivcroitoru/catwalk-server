import express from 'express';
import DB from '../db.js';

const router = express.Router();



//route for client to fetch all shop items
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



//delete shop item by id
router.delete('/delete/:itemId', async (req, res) => {
  const itemId = req.params.itemId;

  try {
    // Start transaction
    await db.query('BEGIN');

    // 1. Get the template for this itemId
    const { rows } = await db.query(
      'SELECT template FROM itemtemplate WHERE item_id = $1',
      [itemId]
    );

    if (rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const template = rows[0].template;

    // 2. Delete from cat_items where template matches
    await db.query('DELETE FROM cat_items WHERE template = $1', [template]);

    // 3. Delete from player_items where template matches
    await db.query('DELETE FROM player_items WHERE template = $1', [template]);

    // 4. Delete from itemtemplate where item_id matches
    await db.query('DELETE FROM itemtemplate WHERE item_id = $1', [itemId]);

    // Commit transaction
    await db.query('COMMIT');

    res.json({ message: 'Item and related references deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete the item' });
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

//add new clothes item to shop
router.post('/clothesadd', async (req, res) => {
  const {
    template,
    category,
    name,
    description,
    price,
    sprite_url,
    sprite_url_preview
  } = req.body;

  if (!template) {
    return res.status(400).json({ error: "Missing required field: template" });
  }

  try {
    const result = await DB.query(
      `INSERT INTO itemtemplate
       (template, category, name, description, price, sprite_url, sprite_url_preview, created_at, last_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [template, category, name, description, price, sprite_url, sprite_url_preview]
    );

    res.status(201).json({
      message: "Item added successfully",
      item: result.rows[0],
    });
  } catch (err) {
    console.error("Detailed error:", err.stack || err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});




export default router;