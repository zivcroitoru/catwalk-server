// /routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DB from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT Auth Middleware
function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const router = express.Router();

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

    const user = {
      id: insertResult.rows[0].id,
      username: insertResult.rows[0].username
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });

    console.log('✅ Signup successful, token generated');

    res.status(201).json({
      message: 'Signup successful',
      user,
      token
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───────────── LOGIN ─────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log("🔐 Received login request:", req.body);

    const userResult = await DB.query(
      'SELECT * FROM players WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const userData = {
      id: user.id,
      username: user.username
    };

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '24h' });

    console.log('✅ Login successful, token generated');

    res.status(200).json({
      message: 'Login successful',
      user: userData,
      token
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────── LOGOUT ─────────────
router.post('/logout', (_req, res) => {
  // With JWT, we don't need to do anything server-side
  // The client just needs to remove the token
  console.log('🚪 Client logged out');
  res.status(200).json({ message: 'Logout successful' });
});

// ───────────── AUTH CHECK ─────────────
router.get('/me', requireLogin, (req, res) => {
  console.log('🔍 Authenticated user:', req.user);
  res.status(200).json({
    message: 'You are logged in!',
    user: req.user
  });
});

export default router;
