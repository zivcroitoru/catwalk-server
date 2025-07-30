import './utils.js'; // this will read ./.env
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import http from 'http';
import { Server } from 'socket.io';
import DB from './db.js';
// Import routes
import authRoutes from './routes/auth.js';
import catsRoutes from './routes/cats.js';
import playersRoutes from './routes/players.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admins.js';
import userItemsRoutes from './routes/userItems.js';      // 👈 Add this line
import { initFashionShowConfig } from './fashion-show.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// ───────────── CORS Config ─────────────

const allowedOrigins = [
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


app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api/cats', catsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/user-items', userItemsRoutes);      // 👈 Add this line

initFashionShowConfig(server);

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

server.listen(PORT, () => {
  console.log(`running on http://localhost:${PORT}`);
});
