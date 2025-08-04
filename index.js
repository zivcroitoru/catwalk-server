// index.js – catwalk-server entry point
import './utils.js'; // Load environment variables
import express from 'express';
import cors from 'cors';
import DB from './db.js';

// ───────────── Routes ─────────────
import authRoutes from './routes/auth.js';
import mailboxRoutes from './routes/mailbox.js';
import catsRoutes from './routes/cats.js';
import playersRoutes from './routes/players.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admins.js';
import player_itemsRoutes from './routes/player_items.js';
import catItemsRoutes from './routes/cat_items.js';
// import { initFashionShowConfig } from './fashion-show.js';

// ───────────── App Setup ─────────────
const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
];

// ───────────── CORS Config ─────────────
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
app.use('/api/cat_items', catItemsRoutes); 
app.use('/api/players', playersRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/playerItems', player_itemsRoutes);
app.use('/api/mailbox', mailboxRoutes);

// ───────────── Fashion Show Setup ─────────────
// initFashionShowConfig(app); // Changed from server to app

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
app.listen(PORT, async () => {
  try {
    console.log('Mailbox HTTP API initialized');
    console.log(`catwalk-server running on http://localhost:${PORT}`);
  } catch (error) {
    console.error('Failed to initialize server:', error);
  }
});