const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const DB = require('../db');

//Middleware: Require login for protected routes
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    next();
}

//SIGNUP ROUTE
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const existingUser = await DB.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await DB.query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully' });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

//LOGIN ROUTE
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const userResult = await DB.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password!' });
        }

        const user = userResult.rows[0];

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        //Store user in session
        req.session.user = {
            id: user.id,
            username: user.username
        };

        res.status(200).json({ message: 'Login successful', user: req.session.user });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

//LOGOUT ROUTE
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }

        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful' });
    });
});

// Protected route to get logged-in user's info
router.get('/me', requireLogin, (req, res) => {
    res.status(200).json({
        message: 'You are logged in!',
        user: req.session.user
    });
});


module.exports = router;
