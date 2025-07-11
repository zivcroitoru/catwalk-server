const express = require('express');
const router = express.Router();
const DB = require('../db');

// GET player info
router.get('/', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM players');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create player
router.post('/', async (req, res) => {
  const { username, coins } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  try {
    const result = await DB.query(
      'INSERT INTO players (username, coins) VALUES ($1, $2) RETURNING *',
      [username, coins || 0] // Default to 0 coins if not provided
    );
    res.status(201).json({ message: 'Player created', player: result.rows[0] });
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update player
router.put('/:id', async (req, res) => {
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

    values.push(id); // for WHERE clause

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
});

// DELETE player
router.delete('/:id', (req, res) => {
  res.status(200).json({ message: 'DELETE player - placeholder' });
});

module.exports = router;
