import express from 'express'; // import express framework
import DB from '../db.js';// import your DB connection/module

const router = express.Router(); // create a new router

//list all the cats ^.,.^
router.get('/', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM player_cats');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST a new cat ≽^•⩊•^≼
router.post('/', async (req, res) => {
  const { player_id, name, breed, variant, palette, description} = req.body; //correct

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

// PUT update a cat ฅ^•ﻌ•^ฅ
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


// GET /api/cats/:playerId ≽^• ˕ • ྀི≼
router.get('/:playerId', async (req, res) => {
  const { playerId } = req.params;

  try {
    const { rows } = await DB.query('SELECT image_url FROM player_cats WHERE player_id = $1', [playerId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No cat images found for this player' });
    }

    res.json(rows); // [{ image_url: '...' }, { image_url: '...' }]
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// DELETE a cat ^. .^₎Ⳋ
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

export default router;