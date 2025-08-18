import DB from '../../db.js';

const categoryMap = { hat: 'hats', top: 'tops', eyes: 'eyes', accessories: 'accessories' };
const singularFromDb = { hats: 'hat', tops: 'top', eyes: 'eyes', accessories: 'accessories' };

function normalizeSingle(value) {
  if (Array.isArray(value)) return value.find(Boolean) ?? null;
  return value ?? null;
}

// PATCH: Update Cat Equipment
export async function patchCatEquipment(req, res) {
  const catId = parseInt(req.params.catId, 10);
  const { equipment } = req.body;

  if (!equipment || typeof equipment !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid equipment' });
  }

  try {
    const owner = await DB.query(`SELECT player_id FROM player_cats WHERE cat_id = $1`, [catId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: 'Cat not found' });
    const player_id = owner.rows[0].player_id;

    for (const [rawKey, rawVal] of Object.entries(equipment)) {
      const category = categoryMap[rawKey];
      if (!category) continue;

      const template = normalizeSingle(rawVal);

      if (template === null || template === '') {
        await DB.query(
          `DELETE FROM cat_items WHERE cat_id = $1 AND category = $2`,
          [catId, category]
        );
        continue;
      }

      if (typeof template !== 'string') continue;

      await DB.query(
        `INSERT INTO cat_items (cat_id, player_id, category, template)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cat_id, category)
         DO UPDATE SET template = EXCLUDED.template`,
        [catId, player_id, category, template]
      );
    }

    res.status(200).json({ success: true, catId });
  } catch (error) {
    console.error('DB ERROR during PATCH:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// GET: Fetch singular-slot equipment
export async function getCatEquipment(req, res) {
  const catId = parseInt(req.params.catId, 10);

  try {
    const result = await DB.query(
      `SELECT category, template FROM cat_items WHERE cat_id = $1`,
      [catId]
    );

    const equipment = { hat: null, top: null, eyes: null, accessories: null };
    for (const row of result.rows) {
      const key = singularFromDb[row.category];
      if (!key) continue;
      equipment[key] = row.template ?? null;
    }

    res.status(200).json({ catId, equipment });
  } catch (error) {
    console.error('Failed to fetch equipment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
