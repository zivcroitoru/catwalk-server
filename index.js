const express = require('express');
const cors = require('cors');
const session = require('express-session');

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
    secure: false, // set to true in production with HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));


// Plug in all routes
app.use('/auth', authRoutes);
app.use('/cats', catsRoutes);
app.use('/players', playersRoutes);
app.use('/shop', shopRoutes);


app.get('/api/test', (req, res) => {
  DB.query("select * from users")
    .then((response) => { console.log(response.rows) });
  res.json({ message: 'Hello from server' });
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
      res.status(404).send("ERROR");
    })
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});