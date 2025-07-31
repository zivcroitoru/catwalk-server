import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcrypt';

const router = express.Router();



router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
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

//messages 
// Get all tickets for admin dashboard
router.get('/api/admin/tickets', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, p.username AS player_username
      FROM tickets t
      JOIN players p ON t.player_id = p.id
      ORDER BY t.last_activity_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get admin tickets:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});


export default router;