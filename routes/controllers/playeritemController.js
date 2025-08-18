// controllers/playeritemController.js
import DB from '../../db.js';

// ───────────── Get all items for the logged-in player ─────────────
export const getPlayerItems = async (req, res) => {
  const playerId = req.user.id;

  try {
    const result = await DB.query(
      `SELECT pi.player_item_id, pi.template, it.name, it.category, it.price, it.sprite_url_preview
       FROM player_items pi
       JOIN itemtemplate it ON pi.template = it.template
       WHERE pi.player_id = $1`,
      [playerId]
    );

    res.status(200).json({ items: result.rows });
  } catch (err) {
    console.error('getPlayerItems error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch player items' });
  }
};

// ───────────── Buy an item for the logged-in player ─────────────
export const buyPlayerItem = async (req, res) => {
  const playerId = req.user.id;
  const { template } = req.body;

  if (!template) {
    return res.status(400).json({ error: 'Missing template in request body' });
  }

  try {
    // 1️⃣ Check item price
    const itemResult = await DB.query(
      'SELECT price FROM itemtemplate WHERE template = $1',
      [template]
    );

    if (itemResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid item template' });
    }

    const price = itemResult.rows[0].price;

    // 2️⃣ Deduct coins if enough balance
    const updateResult = await DB.query(
      `UPDATE players
       SET coins = coins - $1
       WHERE id = $2 AND coins >= $1
       RETURNING coins`,
      [price, playerId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(400).json({ error: 'Not enough coins' });
    }

    // 3️⃣ Add item to player_items
    const insertResult = await DB.query(
      `INSERT INTO player_items (player_id, template)
       VALUES ($1, $2)
       RETURNING *`,
      [playerId, template]
    );

    res.status(200).json({
      message: 'Item purchased successfully',
      item: insertResult.rows[0],
      coins: updateResult.rows[0].coins
    });
  } catch (err) {
    console.error('buyPlayerItem error:', err.stack || err);
    res.status(500).json({ error: 'Server error while purchasing item' });
  }
};

// ───────────── Update a player item (PATCH) ─────────────
export const updatePlayerItem = async (req, res) => {
  console.log('PATCH /playerItems body:', req.body);

  const playerId = req.user.id;
  const { player_item_id, newTemplate } = req.body;

  if (!player_item_id || !newTemplate) {
    return res.status(400).json({ error: 'Missing player_item_id or newTemplate' });
  }

  try {
    // Optional: Check that the new template exists
    const templateCheck = await DB.query(
      'SELECT * FROM itemtemplate WHERE template = $1',
      [newTemplate]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid item template' });
    }

    // Update the player's item
    const result = await DB.query(
      `UPDATE player_items
       SET template = $1
       WHERE player_item_id = $2 AND player_id = $3
       RETURNING *`,
      [newTemplate, player_item_id, playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found or not yours' });
    }

    res.status(200).json({
      message: 'Player item updated successfully',
      item: result.rows[0]
    });
  } catch (err) {
    console.error('updatePlayerItem error:', err.stack || err);
    res.status(500).json({ error: 'Server error while updating item' });
  }
};

export default {
  getPlayerItems,
  buyPlayerItem,
  updatePlayerItem
};