import express from 'express';
import DB from '../db.js';

const router = express.Router();

router.get('/broadcasts', async (req, res) => {
  console.log("GET /broadcasts route hit");   // <-- check if this prints
  try {
    const result = await DB.query('SELECT * FROM public.broadcasts');
    res.status(200).json(result.rows);
    console.log('DB rows:', result.rows);    // <-- check what the DB returns
  } catch (err) {
    console.error('Failed to fetch broadcasts:', err);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});


// Save a broadcast
router.post('/broadcasts', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await DB.query(
      'INSERT INTO broadcasts (body) VALUES ($1) RETURNING *',
      [message]
    );

    // Just return the inserted row, no Socket.IO emit
    return res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Error saving broadcast:', err);
    return res.status(500).json({ error: 'Failed to save broadcast' });
  }
});



export default router;
// }
