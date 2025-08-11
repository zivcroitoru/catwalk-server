// // /routes/cats.js
// import express from 'express';
// import DB from '../db.js';
// import jwt from 'jsonwebtoken';

// const router = express.Router();

// // ───────────── JWT Auth Middleware ─────────────
// function requireAuth(req, res, next) {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) return res.status(401).json({ error: 'No token provided' });

//   const token = authHeader.split(' ')[1];
//   try {
//     req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
//     next();
//   } catch {
//     return res.status(401).json({ error: 'Invalid or expired token' });
//   }
// }

// // ───────────── GET: Player's Cats ─────────────
// router.get('/', requireAuth, async (req, res) => {
//   try {
//     const result = await DB.query(
//       'SELECT * FROM player_cats WHERE player_id = $1',
//       [req.user.id]
//     );
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching cats:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // ───────────── GET: All Cat Templates (Public) ─────────────
// router.get('/allcats', async (req, res) => {
//   try {
//     const result = await DB.query('SELECT * FROM cat_templates');
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching cats:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // ───────────── GET: Cat by Template (Public) ─────────────
// router.get('/template/:template', async (req, res) => {
//   const { template } = req.params;
//   try {
//     const result = await DB.query(
//       'SELECT * FROM cat_templates WHERE template = $1',
//       [template]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Cat not found' });
//     }
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error('Error fetching cat:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // ───────────── PATCH: Update Sprite URL (Admin use?) ─────────────
// router.patch('/allcats/:id', async (req, res) => {
//   const catId = req.params.id;
//   const { sprite_url } = req.body;

//   if (!sprite_url) {
//     return res.status(400).json({ error: 'Missing sprite_url in request body' });
//   }

//   try {
//     const result = await DB.query(
//       'UPDATE cat_templates SET sprite_url = $1 WHERE cat_id = $2 RETURNING *',
//       [sprite_url, catId]
//     );

//     if (result.rowCount === 0) {
//       return res.status(404).json({ error: 'Cat not found' });
//     }

//     res.json({ message: 'Cat sprite_url updated', cat: result.rows[0] });
//   } catch (err) {
//     console.error('Error updating cat sprite_url:', err);
//     res.status(500).json({ error: 'Server error', catId, sprite_url });
//   }
// });

// // ───────────── POST: Create New Cat (Auth) ─────────────
// router.post('/', requireAuth, async (req, res) => {
//   const {
//     template,
//     name,
//     description,
//     uploaded_photo_url,
//     birthdate
//   } = req.body;

//   const player_id = req.user.id;

//   if (!player_id || !template || !name || !birthdate) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   try {
//     const result = await DB.query(
//       `INSERT INTO player_cats (
//          player_id, template, name, description,
//          uploaded_photo_url, birthdate, created_at, last_updated
//        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
//        RETURNING *`,
//       [
//         player_id,
//         template,
//         name,
//         description || '',
//         uploaded_photo_url || '',
//         birthdate
//       ]
//     );

//     res.status(201).json({ message: 'Cat created!', cat: result.rows[0] });
//   } catch (error) {
//     console.error('❌ Error inserting cat:', error);
//     res.status(500).json({ error: 'Server error while inserting cat' });
//   }
// });

// // ───────────── PATCH: Update Cat (Auth) ─────────────
// router.patch('/:id', requireAuth, async (req, res) => {
//   const { id } = req.params;
//   const updates = req.body;

//   const setCols = [];
//   const values = [];
//   let idx = 1;

//   const push = (col, val) => {
//     setCols.push(`${col} = $${idx}`);
//     values.push(val);
//     idx++;
//   };

//   if (updates.name !== undefined) push('name', updates.name);
//   if (updates.description !== undefined) push('description', updates.description);
//   if (updates.template !== undefined) push('template', updates.template);
//   if (updates.equipment !== undefined)
//     push('equipment', typeof updates.equipment === 'object'
//       ? JSON.stringify(updates.equipment)
//       : updates.equipment);

//   if (setCols.length === 0) {
//     return res.status(400).json({ error: 'No updatable fields supplied' });
//   }

//   // id + player ID
//   values.push(id, req.user.id);

//   console.log('🔧 PATCH /cats/:id', {
//     id,
//     userId: req.user.id,
//     updates,
//     setCols,
//     values
//   });

//   try {
//     const { rows } = await DB.query(
//       `UPDATE player_cats
//           SET ${setCols.join(', ')}, last_updated = NOW()
//         WHERE cat_id = $${idx} AND player_id = $${idx + 1}
//         RETURNING *`,
//       values
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ error: 'Cat not found or not yours' });
//     }

//     res.json({ message: 'Cat updated', cat: rows[0] });
//   } catch (err) {
//     console.error('❌ SQL error in PATCH /cats/:id:', err);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// // ───────────── DELETE: Remove Cat (Auth) ─────────────
// router.delete('/:id', requireAuth, async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await DB.query(
//       'DELETE FROM player_cats WHERE cat_id = $1 AND player_id = $2 RETURNING *',
//       [id, req.user.id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Cat not found or not yours' });
//     }

//     res.status(200).json({ message: 'Cat deleted successfully', cat: result.rows[0] });
//   } catch (error) {
//     console.error('Error deleting cat:', error);
//     res.status(500).json({ error: 'Server error while deleting cat' });
//   }
// });

// // ───────────── GET: Player Cats by ID (Public) ─────────────
// router.get('/player/:playerId', async (req, res) => {
//   const { playerId } = req.params;

//   try {
//     const result = await DB.query(
//       `SELECT ct.sprite_url, ct.variant, ct.palette, ct.breed, pc.name, pc.description, pc.cat_id, pc.birthdate
//        FROM player_cats pc
//        INNER JOIN cat_templates ct ON pc.template = ct.template
//        WHERE pc.player_id = $1`,
//       [playerId]
//     );
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching player cats:', error);
//     res.status(500).json({ error: 'Server error while fetching cats' });
//   }
// });

// // ───────────── POST: Add Template ─────────────
// router.post('/catadd', async (req, res) => {
//   const { template, breed, variant, palette, description, sprite_url } = req.body;

//   if (!template || !breed || !variant || !palette || !description || !sprite_url) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   try {
//     const result = await DB.query(
//       `INSERT INTO cat_templates (template, breed, variant, palette, description, sprite_url)
//        VALUES ($1, $2, $3, $4, $5, $6)
//        RETURNING *`,
//       [template, breed, variant, palette, description, sprite_url]
//     );

//     res.status(201).json({ message: 'Cat template added', cat: result.rows[0] });
//   } catch (error) {
//     console.error('Error inserting cat template:', error);
//     res.status(500).json({ error: 'Server error during insert' });
//   }
// });

// // ───────────── DELETE: Remove Cat Template (Admin) ─────────────
// router.delete('/delete/:cat_id', async (req, res) => {
//   const { cat_id } = req.params;
//   try {
//     await DB.query('DELETE FROM cat_templates WHERE cat_id = $1', [cat_id]);
//     res.json({ message: 'Cat deleted successfully' });
//   } catch (error) {
//     console.error('Delete cat error:', error);
//     res.status(500).json({ error: 'Failed to delete cat' });
//   }
// });


// export default router;

// /routes/cats.js
import express from 'express';
import DB from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ───────────── JWT Auth Middleware ─────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn('No Authorization header received');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    console.log('Authenticated user:', req.user.id);
    next();
  } catch (err) {
    console.warn('Invalid or expired token:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ───────────── GET: Player's Cats ─────────────
router.get('/', requireAuth, async (req, res) => {
  console.log(`GET /api/cats hit by player ID: ${req.user?.id}`);
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

// ───────────── GET: All Cat Templates (Public) ─────────────
router.get('/allcats', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM cat_templates');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching cats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── GET: Cat by Template (Public) ─────────────
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

// ───────────── PATCH: Update Sprite URL (Admin use?) ─────────────
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

// ───────────── POST: Create New Cat (Auth) ─────────────
router.post('/', requireAuth, async (req, res) => {
  const {
    template,
    name,
    description,
    uploaded_photo_url,
    birthdate
  } = req.body;

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
});

// ───────────── PATCH: Update Cat (Auth) ─────────────
router.patch('/:id', requireAuth, async (req, res) => {
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

  // id + player ID
  values.push(id, req.user.id);

  console.log('🔧 PATCH /cats/:id', {
    id,
    userId: req.user.id,
    updates,
    setCols,
    values
  });

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
});

// ───────────── DELETE: Remove Cat (Auth) ─────────────
router.delete('/:id', requireAuth, async (req, res) => {
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
});

// ───────────── GET: Player Cats by ID (Public) ─────────────
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

// ───────────── POST: Add Template ─────────────
router.post('/catadd', async (req, res) => {
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
});

// ───────────── DELETE: Remove Cat Template (Admin) ─────────────
// router.delete('/delete/:cat_id', async (req, res) => {
//   const { cat_id } = req.params;
//   try {
//     await DB.query('DELETE FROM cat_templates WHERE cat_id = $1', [cat_id]);
//     res.json({ message: 'Cat deleted successfully' });
//   } catch (error) {
//     console.error('Delete cat error:', error);
//     res.status(500).json({ error: 'Failed to delete cat' });
//   }
// });

router.delete('/delete/:catId', async (req, res) => {
  const catId = req.params.catId;

  try {
    await db.query('BEGIN');

    // Find the template for this cat
    const result = await db.query(
      'SELECT template FROM cat_templates WHERE cat_id = $1',
      [catId]
    );

    if (result.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Cat not found' });
    }

    const template = result.rows[0].template;

    // Delete player cats that reference this template
    await db.query('DELETE FROM player_cats WHERE template = $1', [template]);

    // Delete the cat template
    await db.query('DELETE FROM cat_templates WHERE cat_id = $1', [catId]);

    await db.query('COMMIT');
    res.json({ message: 'Cat deleted successfully' });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



export default router;
