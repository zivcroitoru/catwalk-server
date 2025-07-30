import './utils.js'; // this will read ./.env
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import http from 'http';
import { Server } from 'socket.io';
import DB from './db.js';
// Import routes
import authRoutes from './routes/auth.js';
import catsRoutes from './routes/cats.js';
import playersRoutes from './routes/players.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admins.js';
import { initFashionShowConfig } from './fashion-show.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// ───────────── CORS Config ─────────────
// Allow credentials, but NOT '*' origin
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://catwalk-client.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow REST clients, tools, curl, or SSR with no origin header
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));

// ───────────── Body Parser ─────────────
app.use(express.json());

// ───────────── Session Setup ─────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcatwalkcookie',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// ───────────── Routes ─────────────
app.use('/auth', authRoutes);
app.use('/api/cats', catsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admins', adminRoutes);

// ───────────── Fashion Show Socket.io ─────────────
initFashionShowConfig(server);

// ───────────── Test Endpoints ─────────────
app.get('/api/test', (req, res) => {
  DB.query("SELECT * FROM players")
    .then((response) => {
      console.log(response.rows);
      res.json({ message: 'Hello from server' });
    });
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

// ───────────── Start Server ─────────────
server.listen(PORT, () => {
  console.log(`running on http://localhost:${PORT}`);
});
