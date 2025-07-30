const express = require('express');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
require("dotenv").config();
const path = require('path');
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
const userItemsRoutes = require('./routes/userItems');

// ──────── Allowed Origins ────────
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5173',
  'https://catwalk-server.onrender.com'
];

// ──────── Trust Proxy (for cookies on Render) ────────
app.set('trust proxy', 1);

// ──────── Session ────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcatwalkcookie',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// ──────── CORS ────────
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// ──────── Middleware ────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ──────── Routes ────────
app.use('/auth', authRoutes);
app.use('/cats', catsRoutes);
app.use('/players', playersRoutes);
app.use('/api/shop-items', shopRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/cat-templates', catTemplatesRoutes);
app.use('/api/user-items', userItemsRoutes);

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

app.get('/api/wow', async (req, res) => {
  try {
    const response = await DB.query('SELECT * FROM players');
    if (response.rows.length === 0) {
      return res.status(200).send("Not found");
    }
    res.status(200).send(response.rows);
  } catch (error) {
    console.error(error);
    res.status(404).send("ERROR");
  }
});

// ──────── Socket.io Config ────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.emit('welcome', 'Welcome to the CatWalk socket server!');
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ──────── Start Server ────────
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
