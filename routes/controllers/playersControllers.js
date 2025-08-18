import DB from '../../db.js';

// GET all players
export async function getPlayers(req, res) {
  try {
    const result = await DB.query('SELECT * FROM players');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST create player
export async function createPlayer(req, res) {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  try {
    const coinsToInsert = 500;
    const result = await DB.query(
      'INSERT INTO players (username, coins) VALUES ($1, $2) RETURNING *',
      [username, coinsToInsert]
    );
    res.status(201).json({ message: 'Player created', player: result.rows[0] });
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET player by ID
export async function getPlayerById(req, res) {
  const { id } = req.params;
  try {
    const result = await DB.query('SELECT * FROM players WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching player by ID:', error);
    res.status(500).json({ error: 'Server error while fetching player' });
  }
}

// PUT update player
export async function updatePlayer(req, res) {
  const { id } = req.params;
  const { username, coins } = req.body;

  if (!username && coins === undefined) {
    return res.status(400).json({ error: 'Provide at least one field: username or coins' });
  }

  try {
    const fields = [];
    const values = [];
    let index = 1;

    if (username) {
      fields.push(`username = $${index++}`);
      values.push(username);
    }
    if (coins !== undefined) {
      fields.push(`coins = $${index++}`);
      values.push(coins);
    }

    values.push(id);

    const query = `
      UPDATE players
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING *`;

    const result = await DB.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.status(200).json({ message: 'Player updated', player: result.rows[0] });
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Server error while updating player' });
  }
}

// DELETE player
export async function deletePlayer(req, res) {
  const { id } = req.params;
  try {
    const result = await DB.query(
      'DELETE FROM players WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.status(200).json({ message: 'Player deleted successfully', player: result.rows[0] });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Server error while deleting player' });
  }
}

// GET cats belonging to a player
export async function getPlayerCats(req, res) {
  const { id: playerId } = req.params;
  try {
    const result = await DB.query(
      `SELECT ct.sprite_url, ct.variant, ct.palette, ct.breed
       FROM player_cats pc
       JOIN cat_templates ct ON pc.template = ct.template
       WHERE pc.player_id = $1`,
      [playerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cat sprites:', err);
    res.status(500).json({ error: 'Failed to fetch cat sprites' });
  }
}

// GET items belonging to a player
export async function getPlayerItems(req, res) {
  const { id: playerId } = req.params;
  try {
    const result = await DB.query(
      `SELECT it.sprite_url_preview, it.category, it.name, it.description, it.price, it.created_at, it.last_updated_at, pi.player_item_id
       FROM player_items pi
       INNER JOIN itemtemplate it ON pi.template = it.template
       WHERE pi.player_id = $1`,
      [playerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching player items:', err);
    res.status(500).json({ error: 'Failed to fetch player items' });
  }
}
