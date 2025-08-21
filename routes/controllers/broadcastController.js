import DB from '../../db.js';

export const getAllBroadcasts = async (_req, res) => {
  try {
    const result = await DB.query('SELECT * FROM broadcasts ORDER BY sent_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Failed to fetch broadcasts:', err);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
};

export const createBroadcast = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const result = await DB.query(
      `INSERT INTO broadcasts (body, sent_at) VALUES ($1, NOW()) RETURNING *`,
      [message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to save broadcast:', err);
    res.status(500).json({ error: 'Failed to save broadcast' });
  }
};


export default { getAllBroadcasts, createBroadcast };
