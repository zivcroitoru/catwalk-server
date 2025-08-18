import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DB from '../../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ───────────── SIGNUP ─────────────
export async function signup(req, res) {
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

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    console.log('Signup successful, token generated');

    res.status(201).json({
      message: 'Signup successful',
      user,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ───────────── LOGIN ─────────────
export async function login(req, res) {
  const { username, password } = req.body;

  try {
    console.log("Received login request:", req.body);

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

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });

    console.log('Login successful, token generated');

    res.status(200).json({
      message: 'Login successful',
      user: userData,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── LOGOUT ─────────────
export function logout(_req, res) {
  console.log('Client logged out');
  res.status(200).json({ message: 'Logout successful' });
}

// ───────────── AUTH CHECK ─────────────
export function getMe(req, res) {
  console.log('Authenticated user:', req.user);
  res.status(200).json({
    message: 'You are logged in!',
    user: req.user
  });
}

export default router;
