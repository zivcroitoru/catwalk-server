const express = require('express');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
require("dotenv").config();
const DB = require('./db');

const app = express();
const server = http.createServer(app);

const PORT = 3000;

// ──────── Import Routes ────────
const authRoutes = require('./routes/auth');
const catsRoutes = require('./routes/cats');
const playersRoutes = require('./routes/players');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admins');
const catTemplatesRoutes = require('./routes/catTemplates');

// ──────── CORS Config ────────
const allowedOrigins = [
  'http://127.0.0.1:5501',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'https://catwalk-server.onrender.com'
];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONEND_URL
    : 'http://localhost:3000',
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// ──────── Middleware ────────
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcatwalkcookie',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// ──────── Routes ────────
app.use('/auth', authRoutes);
app.use('/cats', catsRoutes);
app.use('/players', playersRoutes);
app.use('/shop', shopRoutes);
app.use('/api/admins', adminRoutes);
app.use(catTemplatesRoutes);

// ──────── Test Endpoints ────────
app.get('/api/test', async (req, res) => {
  try {
    const response = await DB.query("SELECT * FROM players");
    console.log("🎯 Neon DB responded with:", response.rows);
    res.json({ message: 'Connected to Neon!', rows: response.rows });
  } catch (err) {
    console.error("❌ Neon DB ERROR:", err.message);
    res.status(500).json({ error: 'DB connection failed' });
  }
});

app.get('/api/wow', (req, res) => {
  const query = 'SELECT * FROM players';
  DB.query(query)
    .then((response) => {
      if (response.rows.length === 0) {
        return res.status(200).send("Not found");
      }
      res.status(200).send(response.rows);
    })
    .catch((error) => {
      console.error(error);
      res.status(404).send("ERROR");
    });
});

// ──────── Start Server ────────
server.listen(PORT, () => {
  console.log(`running on http://localhost:${PORT}`);
});

// ──────── Socket.io Logic ────────
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.emit('welcome', 'Welcome to the CatWalk socket server!');
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
