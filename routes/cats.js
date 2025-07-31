// /routes/cats.js
import express from 'express';
import DB from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// JWT Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ───────────── GET: Player's Cats ─────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await DB.query(
      'SELECT * FROM player_cats WHERE player_id = $1',
      [req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── GET: All Cat Templates ─────────────
router.get('/allcats', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM cat_templates');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── GET: Cat by Template ─────────────
router.get('/template/:template', async (req, res) => {
  const { template } = req.params;
  try {
    const result = await DB.query(
      'SELECT * FROM cat_templates WHERE template = $1',
      [template]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cat not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching cat:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── PATCH: Update Sprite URL ─────────────
router.patch('/allcats/:id', async (req, res) => {
  const catId = req.params.id;
  const { sprite_url } = req.body;

  if (!sprite_url) {
    return res.status(400).json({ error: 'Missing sprite_url in request body' });
  }

  try {
    const result = await DB.query(
      'UPDATE cat_templates SET sprite_url = $1 WHERE cat_id = $2 RETURNING *',
      [sprite_url, catId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cat not found' });
    }

    res.json({ message: 'Cat sprite_url updated', cat: result.rows[0] });
  } catch (err) {
    console.error('Error updating cat sprite_url:', err);
    res.status(500).json({ error: 'Server error', catId, sprite_url });
  }
});

// ───────────── POST: Create New Cat ─────────────
router.post('/', async (req, res) => {
  const {
    player_id,
    template,
    name,
    description,
    uploaded_photo_url,
    birthdate
  } = req.body;

  if (!player_id || !template || !name || !birthdate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await DB.query(
      `INSERT INTO player_cats (
         player_id, template, name, description,
         uploaded_photo_url, birthdate, created_at, last_updated
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        player_id,
        template,
        name,
        description || '',
        uploaded_photo_url || '',
        birthdate
      ]
    );

    res.status(201).json({ message: 'Cat created!', cat: result.rows[0] });
  } catch (error) {
    console.error('❌ Error inserting cat:', error);
    res.status(500).json({ error: 'Server error while inserting cat' });
  }
});

// ───────────── PUT: Update Cat ─────────────
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

// ───────────── GET: All Cats for Player ID ─────────────
router.get('/player/:playerId', async (req, res) => {
  const { playerId } = req.params;

  try {
    const result = await DB.query(
      `SELECT ct.sprite_url, ct.variant, ct.palette, ct.breed, pc.name, pc.description, pc.cat_id, pc.birthdate
       FROM player_cats pc
       INNER JOIN cat_templates ct ON pc.template = ct.template
       WHERE pc.player_id = $1`,
      [playerId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching player cats:', error);
    res.status(500).json({ error: 'Server error while fetching cats' });
  }
});

// ───────────── DELETE: Remove Cat ─────────────
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
