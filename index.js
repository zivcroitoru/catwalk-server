const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./passport')
require("dotenv").config();
const DB = require('./db');

const app = express();
const PORT = 3000;

const authRoutes = require('./routes/auth');
const catsRoutes = require('./routes/cats');
const playersRoutes = require('./routes/players');
const shopRoutes = require('./routes/shop');

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcatwalkcookie',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session())

app.use('/auth', authRoutes);
app.use('/cats', catsRoutes);
app.use('/players', playersRoutes);
app.use('/shop', shopRoutes);


app.get('/api/test', async (req, res) => {
  try {
    const response = await DB.query("SELECT * FROM users");
    console.log(response.rows);
    res.json({ message: 'Hello from server' });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get('/api/wow', (req, res) => {
  query = 'select * from users';
  DB.query(query)
    .then((response) => {
      if (response.rows.length === 0) {
        res.status(200).send("Not found");
      }
      res.status(200).send(response.rows);
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("ERROR");
    })
});

// Route to start Google login
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

// Google redirects here after login
app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login-failed',
    successRedirect: '/login-success'  // <- You can change this
  })
);

// To check who is logged in
app.get('/auth/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

// To log out
app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});