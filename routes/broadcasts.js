import express from 'express';
import DB from '../db.js';

const router = express.Router();

router.get('/broadcasts', async (req, res) => {
    console.log("GET /broadcasts route hit");   // <-- check if this prints
    try {
        const result = await DB.query('SELECT * FROM public.broadcasts ORDER BY sent_at DESC');
        res.status(200).json(result.rows);
        console.log('DB rows:', result.rows);    // <-- check what the DB returns
    } catch (err) {
        console.error('Failed to fetch broadcasts:', err);
        res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }
});


// Save a broadcast
router.post('/broadcasts', async (req, res) => {
  const { message } = req.body;
  console.log('Incoming broadcast message:', message);
  try {
    const result = await DB.query(
      `INSERT INTO broadcasts(body) VALUES($1) RETURNING id, body, sent_at`,
      [message]
    );
    console.log('Broadcast saved:', result.rows[0]);
    const savedBroadcast = result.rows[0];

    io.emit('adminBroadcast', { 
      message: savedBroadcast.body,
      date: savedBroadcast.sent_at 
    });

    res.status(201).json(savedBroadcast);
  } catch (err) {
    console.error('Error saving broadcast:', err);
    res.status(500).json({ error: 'Failed to save broadcast' });
  }
});



export default router;
// }
