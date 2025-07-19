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

// SIGNUP ROUTE
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    console.log("here");
    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if username already exists
        const existingUser = await DB.query(
            'SELECT * FROM players WHERE username = $1',
            [username]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Hash the password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert new user into players table
        const insertResult = await DB.query(
            `INSERT INTO players (username, password_hash)
             VALUES ($1, $2)
             RETURNING id, username`,
            [username, password_hash]
        );

        // Set session
        req.session.user = {
            id: insertResult.rows[0].id,
            username: insertResult.rows[0].username
        };

        res.status(201).json({ message: 'Signup successful', user: req.session.user });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


//LOGIN ROUTE
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        console.log("Received login request:", req.body)
        const userResult = await DB.query(
            "SELECT * FROM players WHERE username = $1",
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: "User not found" });
        }

        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: "Incorrect password" });
        }

        res.status(200).json({ message: "Login successful", username: user.username });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
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
