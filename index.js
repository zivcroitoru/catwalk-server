const express = require('express');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
require("dotenv").config();
const DB = require('./db');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',      // Allow all origins
  credentials: true, // Note: credentials cannot be used with '*', see below
}));

// const devAllowedOrigins = [
//   'http://127.0.0.1:5500',
//   'http://localhost:5500'
// ];

// app.use(cors({
//   origin: process.env.NODE_ENV === 'production'
//     ? process.env.FRONTEND_URL
//     : ['http://localhost:3000', 'http://127.0.0.1:3000'],
//   credentials: true, // Enable for both dev and production
// }));

// Fixed 
// app.use(cors({- 
// app.use(cors({
//   origin: '*',      // Allow all origins
//   credentials: true, // Note: credentials cannot be used with '*', see below
// }));
// // To:
// app.use(cors({
//   origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
//   credentials: true
// }));

// Socket.io is used in the fashion-show - so we disable it here.
// const io = new Server(server);
// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);
//   // Send welcome message to the newly connected user
//   socket.emit('welcome', 'Welcome to the CatWalk socket server!');
//   socket.on('disconnect', () => {
//     console.log('User disconnected:', socket.id);
//   });
// });

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
app.use('/shop', shopRoutes);
app.use('/api/admins', adminRoutes);

// Test API endpoints
app.get('/api/test', (req, res) => {
  DB.query("SELECT * FROM players")
    .then((response) => {
      console.log(response.rows);
      res.json({ message: 'Hello from server' });
    });
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

// Start the server
server.listen(PORT, () => {
console.log(`running on http://localhost:${PORT}`);
});

// Socket.io logics
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send welcome message to the newly connected user
  socket.emit('welcome', 'Welcome to the CatWalk socket server!');

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ──────── Start Server ────────
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
