import express from 'express';
import DB from '../db.js';
import bcrypt from 'bcrypt';

const router = express.Router();



router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await DB.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (passwordMatch) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assuming you have Express and your DB connection as `db`

// routes/admin.js or similar

router.get('/tickets', async (req, res) => {
  try {
    const result = await DB.query('SELECT * FROM tickets ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


//get the ticket by id
router.get('/messages/:ticketId', async (req, res) => {
  const { ticketId } = req.params;

  try {
    console.log("Received ticket ID:", ticketId);

    const result = await DB.query(
      'SELECT * FROM messages WHERE ticket_id = $1 ORDER BY sent_at ASC',
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No messages found for this ticket' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("DB query failed:", err);
    res.status(500).json({
      error: 'Server error',
      details: err.message,
    });
  }
});

//respond to a ticket
// routes/messages.js
router.post('/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const { body } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO messages (ticket_id, body, created_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [ticketId, body]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error inserting message:", err);
    res.status(500).json({ error: "Failed to save message" });
  }
});


export default router;