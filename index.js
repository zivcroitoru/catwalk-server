const express = require('express');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
require("dotenv").config();
const DB = require('./db');

const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.io

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:5501'],
    credentials: true
  }
});



const PORT = 3000;

// Import routes
const authRoutes = require('./routes/auth');
const catsRoutes = require('./routes/cats');
const playersRoutes = require('./routes/players');
const shopRoutes = require('./routes/shop');

const adminRoutes = require('./routes/admins');



const allowedOrigins = ['http://127.0.0.1:5501', 'http://localhost:3000', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));




app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));



app.use(session({
  secret: process.env.SESSION_SECRET || 'secretcatwalkcookie',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/cats', catsRoutes);
app.use('/players', playersRoutes);
app.use('/shop', shopRoutes);
app.use('/api/admins', adminRoutes);

// Test API endpoints
app.get('/api/test', (req, res) => {
  DB.query("SELECT * FROM users")
    .then((response) => {
      console.log(response.rows);
      res.json({ message: 'Hello from server' });
    });
});

app.get('/api/wow', (req, res) => {
  const query = 'SELECT * FROM users';
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
  console.log(`Server running on http://localhost:${PORT}`);
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send welcome message to the newly connected user
  socket.emit('welcome', 'Welcome to the CatWalk socket server!');

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
