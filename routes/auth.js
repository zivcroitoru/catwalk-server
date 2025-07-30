// /routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import DB from '../db.js';

const router = express.Router();

// ───────────── Middleware ─────────────
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}

// ───────────── SIGNUP ─────────────
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await DB.query(
      'SELECT * FROM players WHERE username = $1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const insertResult = await DB.query(
      `INSERT INTO players (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username`,
      [username, password_hash]
    );

    req.session.user = {
      id: insertResult.rows[0].id,
      username: insertResult.rows[0].username
    };

    res.status(201).json({
      message: 'Signup successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── LOGIN ─────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    console.log("Received login request:", req.body);

    const userResult = await DB.query(
      'SELECT * FROM players WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.status(200).json({
      message: 'Login successful',
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────── LOGOUT ─────────────
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logout successful' });
  });
});

// ───────────── AUTH CHECK ─────────────
router.get('/me', requireLogin, (req, res) => {
  res.status(200).json({
    message: 'You are logged in!',
    user: req.session.user
  });
});

export default router;
//ok