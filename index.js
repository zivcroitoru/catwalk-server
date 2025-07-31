// index.js – catwalk-server entry point
import './utils.js'; // Load environment variables
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import DB from './db.js';

// ───────────── Routes ─────────────
import authRoutes from './routes/auth.js';
import catsRoutes from './routes/cats.js';
import playersRoutes from './routes/players.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admins.js';
import playerItemsRoutes from './routes/playerItems.js'; // ✅ Renamed
import { initFashionShowConfig } from './fashion-show.js';

// ───────────── Mailbox System ─────────────
import { setupMailbox, setupDatabase } from './mailbox.js';

// ───────────── App Setup ─────────────
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ───────────── Socket.io Setup ─────────────
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'https://catwalk.onrender.com',
        process.env.FRONTEND_URL
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: true
  }
});

// ───────────── CORS Config ─────────────
const allowedOrigins = [
  'http://localhost:3000',
  'https://catwalk.onrender.com',
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));

// ───────────── Middleware ─────────────
app.use(express.json());

// ───────────── Route Mounts ─────────────
app.use('/auth', authRoutes);
app.use('/api/cats', catsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/player_items', playerItemsRoutes); // ✅ Updated path

// ───────────── Fashion Show Setup ─────────────
initFashionShowConfig(server);

// ───────────── Mailbox Setup ─────────────
async function initializeMailbox() {
  try {
    // Setup database tables for mailbox
    await setupDatabase(DB);
    
    // Setup Socket.io mailbox functionality
    const adminFunctions = setupMailbox(io, DB, process.env.JWT_SECRET);
    
    // Make admin functions available globally if needed
    app.locals.mailboxAdmin = adminFunctions;
    
    console.log('📬 Mailbox system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize mailbox system:', error);
  }
}

// Initialize mailbox after server starts
initializeMailbox();

// ───────────── Test Routes ─────────────
app.get('/api/test', (req, res) => {
  DB.query("SELECT * FROM players")
    .then((response) => {
      console.log(response.rows);
      res.json({ message: 'Hello from server' });
    });
});

app.get('/api/wow', (req, res) => {
  DB.query('SELECT * FROM players')
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
  console.log(`✅ catwalk-server running on http://localhost:${PORT}`);
});
