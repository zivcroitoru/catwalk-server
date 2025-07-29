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


const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.io

const PORT = 3000;




app.use(cors({
  origin: process.env.NODE_ENV==='production'?process.env.FRONTEND_URL:'*',
  credentials: process.env.NODE_ENV === 'production',
}));



const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV==='production'?process.env.FRONTEND_URL:'*',
    credentials: process.env.NODE_ENV === 'production'
  }
});

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
app.use('/cats', catsRoutes);
app.use('/api/players', playersRoutes);//
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

// Socket.io logics
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send welcome message to the newly connected user
  socket.emit('welcome', 'Welcome to the CatWalk socket server!');

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

