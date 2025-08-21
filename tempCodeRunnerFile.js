import './utils.js'; // this will read ./.env
import express from 'express';
import cors from 'cors';
import session  from 'express-session';
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

const PORT = 3000;

app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true
}));


app.use(express.json());

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

// Routes
app.use('/auth', authRoutes);
app.use('/api/cats', catsRoutes);
app.use('/api/players', playersRoutes);//
app.use('/api/shop', shopRoutes);
app.use('/api/admins', adminRoutes);

initFashionShowConfig(server);

// Test API endpoints
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

// Start the server
server.listen(PORT, () => {
console.log(`running on http://localhost:${PORT}`);
});

