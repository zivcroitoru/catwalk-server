import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DB from '../../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; 
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// controllers

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

    const password_hash = await bcrypt.hash(password, 10);

    const insertResult = await DB.query(
      `INSERT INTO players (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username`,
      [username, password_hash]
    );

    const user = insertResult.rows[0];
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: 'Signup successful', user, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req, res) {
  const { username, password } = req.body;
  try {
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
    await DB.query(
      'UPDATE players SET last_logged_in = NOW() WHERE id = $1',
      [user.id]
    );

    const userData = { id: user.id, username: user.username };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ message: 'Login successful', user: userData, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}


export function logout(_req, res) {
  res.status(200).json({ message: 'Logout successful' });
}

export function getMe(req, res) {
  res.status(200).json({ message: 'You are logged in!', user: req.user });
}

export async function updateUser(req, res) {
  try {
    const userId = req.user.id;
    const { username, password } = req.body;

    if (!username && !password) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (username) {
      fields.push(`username = $${idx++}`);
      values.push(username);
    }

    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(password_hash);
    }

    const query = `UPDATE players SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username`;
    values.push(userId);

    const result = await DB.query(query, values);

    res.status(200).json({ message: 'User updated', user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

