import express from 'express';
import DB from '../db.js';

const router = express.Router();
export default function createBroadcastRouter(io) {

  // Get all broadcasts
  router.get('/broadcasts', async (req, res) => {
    console.log("GET /broadcasts route hit");
    try {
      const result = await DB.query('SELECT * FROM public.broadcasts ORDER BY sent_at DESC');
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
      res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }
  });

  // Create and send broadcast
  router.post('/broadcasts', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Save to DB
      const result = await DB.query(
        'INSERT INTO broadcasts (body) VALUES ($1) RETURNING *',
        [message]
      );

      const broadcast = result.rows[0];

      // Emit to all connected players
      io.emit('adminBroadcast', {
        message: broadcast.body,
        sent_at: broadcast.sent_at
      });

      console.log("Broadcast emitted to all:", broadcast);

      res.status(201).json(broadcast);
    } catch (err) {
      console.error('Error saving broadcast:', err);
      res.status(500).json({ error: 'Failed to save broadcast' });
    }
  });

  return router;
}