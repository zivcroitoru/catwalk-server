import express from 'express';
import DB from '../db.js';

const router = express.Router();

// Get all messages for a room
router.get('/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;

  try {
    const result = await DB.query(
      `SELECT * FROM messages_list WHERE room_id = $1 ORDER BY timestamp ASC`,
      [roomId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// In messages.js or a new route file
router.get('/rooms', async (req, res) => {
  try {
    // Return distinct room IDs from messages_list table
    const result = await DB.query('SELECT DISTINCT room_id FROM messages_list');
    res.status(200).json(result.rows.map(r => r.room_id));
  } catch (err) {
    console.error('Failed to fetch rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});


export default router;
