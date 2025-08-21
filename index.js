import './utils.js';
import express from 'express';
import cors from 'cors';
import DB from './db.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import setupSocket from './sockets/socket.js';

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Initializing Catwalk Server...');
console.log(` Server will run on port: ${PORT}`);

// Create HTTP server for both Express and Socket.IO
const httpServer = http.createServer(app);

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://catwalk.onrender.com',
  'https://catwalk-server-eu.onrender.com',
  process.env.FRONTEND_URL
];

console.log('Allowed CORS origins:', allowedOrigins);

// Configure CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    console.log("Incoming origin:", origin || 'undefined');
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("Blocked by CORS:", origin);
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Parse JSON payloads
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// ROUTES CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Import and mount main router
import routerPath from './routes/router.js';
app.use("/", routerPath);
console.log(' Main routes loaded from ./routes/router.js');


// Database health check endpoint
app.get('/api/test-db', async (req, res) => {
  console.log('Database health check requested');
  try {
    const result = await DB.query('SELECT NOW()');
    console.log(' Database connection successful');
    res.json({ now: result.rows[0] });
  } catch (error) {
    console.error(' Database connection failed:', error.message);
    res.status(500).send('DB error');
  }
});

// ═══════════════════════════════════════════════════════════════
// SOCKET.IO CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Initialize Socket.IO server with CORS configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

console.log('Socket.IO server initialized');

// Setup socket event handlers
setupSocket(io);
console.log('Socket event handlers configured');

// ═══════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════

// Start the HTTP server
httpServer.listen(PORT, () => {
  console.log(' Catwalk Server successfully started!');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('CORS origins configured:', allowedOrigins.length, 'origins');
});