import DB from '../../db.js';

// ───────────── GET: Player's Cats ─────────────
export async function getPlayerCats(req, res) {
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
}

// ───────────── GET: All Cat Templates (Public) ─────────────
export async function getAllCats(_req, res) {
  try {
    const result = await DB.query('SELECT * FROM cat_templates');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ───────────── GET: Cat by Template (Public) ─────────────
export async function getCatByTemplate(req, res) {
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
}

// ───────────── PATCH: Update Sprite URL (Admin) ─────────────
export async function updateCatSprite(req, res) {
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
    res.status(500).json({ error: 'Server error' });
  }
}

// ───────────── POST: Create New Cat (Auth) ─────────────
export async function createCat(req, res) {
  const { template, name, description, uploaded_photo_url, birthdate } = req.body;
  const player_id = req.user.id;

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
    console.error('Error inserting cat:', error);
    res.status(500).json({ error: 'Server error while inserting cat' });
  }
}

// ───────────── PATCH: Update Cat (Auth) ─────────────
export async function updateCat(req, res) {
  const { id } = req.params;
  const updates = req.body;

  const setCols = [];
  const values = [];
  let idx = 1;

  const push = (col, val) => {
    setCols.push(`${col} = $${idx}`);
    values.push(val);
    idx++;
  };

  if (updates.name !== undefined) push('name', updates.name);
  if (updates.description !== undefined) push('description', updates.description);
  if (updates.template !== undefined) push('template', updates.template);
  if (updates.equipment !== undefined)
    push('equipment', typeof updates.equipment === 'object'
      ? JSON.stringify(updates.equipment)
      : updates.equipment);

  if (setCols.length === 0) {
    return res.status(400).json({ error: 'No updatable fields supplied' });
  }

  values.push(id, req.user.id);

  try {
    const { rows } = await DB.query(
      `UPDATE player_cats
          SET ${setCols.join(', ')}, last_updated = NOW()
        WHERE cat_id = $${idx} AND player_id = $${idx + 1}
        RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cat not found or not yours' });
    }

    res.json({ message: 'Cat updated', cat: rows[0] });
  } catch (err) {
    console.error('SQL error in PATCH /cats/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// ───────────── DELETE: Remove Cat (Auth) ─────────────
export async function deleteCat(req, res) {
  const { id } = req.params;

  try {
    const result = await DB.query(
      'DELETE FROM player_cats WHERE cat_id = $1 AND player_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cat not found or not yours' });
    }

    res.status(200).json({ message: 'Cat deleted successfully', cat: result.rows[0] });
  } catch (error) {
    console.error('Error deleting cat:', error);
    res.status(500).json({ error: 'Server error while deleting cat' });
  }
}

// ───────────── GET: Player Cats by ID (Public) ─────────────
export async function getCatsByPlayer(req, res) {
  const { playerId } = req.params;

  try {
    const result = await DB.query(
      `SELECT ct.sprite_url, ct.variant, ct.palette, ct.breed,
              pc.name, pc.description, pc.cat_id, pc.birthdate
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
}

// ───────────── POST: Add Template ─────────────
export async function addTemplate(req, res) {
  const { template, breed, variant, palette, description, sprite_url } = req.body;

  if (!template || !breed || !variant || !palette || !description || !sprite_url) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await DB.query(
      `INSERT INTO cat_templates (template, breed, variant, palette, description, sprite_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [template, breed, variant, palette, description, sprite_url]
    );

    res.status(201).json({ message: 'Cat template added', cat: result.rows[0] });
  } catch (error) {
    console.error('Error inserting cat template:', error);
    res.status(500).json({ error: 'Server error during insert' });
  }
}

// ───────────── DELETE: Remove Cat Template ─────────────
export async function deleteTemplate(req, res) {
  const { catId } = req.params;

  try {
    await DB.query('BEGIN');

    const { rows } = await DB.query(
      'SELECT template FROM cat_templates WHERE cat_id = $1',
      [catId]
    );

    if (rows.length === 0) {
      await DB.query('ROLLBACK');
      return res.status(404).json({ error: 'Cat not found' });
    }

    const template = rows[0].template;

    await DB.query('DELETE FROM player_cats WHERE template = $1', [template]);
    await DB.query('DELETE FROM cat_templates WHERE cat_id = $1', [catId]);

    await DB.query('COMMIT');

    res.json({ message: 'Cat deleted successfully' });
  } catch (err) {
    await DB.query('ROLLBACK');
    console.error('Error deleting cat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
