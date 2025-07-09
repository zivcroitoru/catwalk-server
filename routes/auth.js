// routes/auth.js

const express = require('express');
const router = express.Router();

// POST /auth/login
router.post('/login', (req, res) => {
  res.status(200).json({ message: 'Login route hit' });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.status(200).json({ message: 'Logout route hit' });
});

module.exports = router;
