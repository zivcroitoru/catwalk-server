import DB from '../db.js';

// GET all shop items (client view)
export async function getShopItems(_req, res) {
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
}

// GET all clothes (admin panel)
export async function getAllClothes(req, res) {
  try {
    const result = await DB.query('SELECT * FROM itemtemplate');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET shop items (admin panel)
export async function getShop(req, res) {
  try {
    const result = await DB.query('SELECT * FROM itemtemplate');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Server error while fetching shop items' });
  }
}

// POST new shop item
export async function createShopItem(req, res) {
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
}

// PUT update shop item
export async function updateShopItem(req, res) {
  const { id } = req.params;
  const { item_name, description, price, type } = req.body;

  if (!item_name || !description || !price || !type) {
    return res.status(400).json({ error: 'Missing required fields for update' });
  }

  try {
    const result = await DB.query(
      `UPDATE itemtemplate
       SET description = $1, price = $2, type = $3
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
}

// DELETE shop item by name
export async function deleteShopItem(req, res) {
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
}

// DELETE shop item by ID (cascade references)
export async function deleteShopItemById(req, res) {
  const { itemId } = req.params;

  try {
    await DB.query('BEGIN');

    const { rows } = await DB.query(
      'SELECT template FROM itemtemplate WHERE item_id = $1',
      [itemId]
    );

    if (rows.length === 0) {
      await DB.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const template = rows[0].template;

    await DB.query('DELETE FROM cat_items WHERE template = $1', [template]);
    await DB.query('DELETE FROM player_items WHERE template = $1', [template]);
    await DB.query('DELETE FROM itemtemplate WHERE item_id = $1', [itemId]);

    await DB.query('COMMIT');
    res.json({ message: 'Item and related references deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    await DB.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete the item' });
  }
}

// PATCH shop item sprite
export async function patchShopItem(req, res) {
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
       RETURNING *`,
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
}

// GET shop item count (test)
export async function testShop(req, res) {
  try {
    const result = await DB.query('SELECT COUNT(*) FROM itemtemplate');
    res.status(200).json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({ error: 'Test query failed' });
  }
}

// GET shop item by template
export async function getShopItemByTemplate(req, res) {
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
}

// POST new clothes item
export async function addClothesItem(req, res) {
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
}
