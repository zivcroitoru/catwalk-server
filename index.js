import './utils.js'; // Load environment variables
import express from 'express';
import cors from 'cors';
import DB from './db.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

// ───────────── App Setup ─────────────
const app = express();
const PORT = process.env.PORT || 3001;

// ───────────── HTTP Server Setup ─────────────
const httpServer = http.createServer(app);

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

// ───────────── Routes ─────────────
import authRoutes from './routes/auth.js';
import messagesRoutes from './routes/messages.js';
import catsRoutes from './routes/cats.js';
import playersRoutes from './routes/players.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admins.js';
import player_itemsRoutes from './routes/player_items.js';
import catItemsRoutes from './routes/cat_items.js';
import mailboxRoutes from './routes/mailbox.js';

app.use('/auth', authRoutes);
app.use('/api/cats', catsRoutes);
app.use('/api/cat_items', catItemsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/playerItems', player_itemsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/mailbox', mailboxRoutes);

// ───────────── Test Routes ─────────────
app.get('/api/test', async (req, res) => {
  const response = await DB.query("SELECT * FROM players");
  console.log(response.rows);
  res.json({ message: 'Hello from server' });
});

app.get('/api/wow', async (req, res) => {
  try {
    const response = await DB.query("SELECT * FROM players");
    if (response.rows.length === 0) {
      return res.status(200).send("Not found");
    }
    res.status(200).send(response.rows);
  } catch (error) {
    console.error(error);
    res.status(404).send("ERROR");
  }
});



// ───────────── Socket.IO Setup ─────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Map to track player userId to socket id
const playerSockets = new Map();
const adminSockets = new Set();


function removeSocketFromMaps(socket) {
  adminSockets.delete(socket.id);

  for (const [userId, sId] of playerSockets.entries()) {
    if (sId === socket.id) {
      playerSockets.delete(userId);
      break;
    }
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);


  // Admin registers themselves
  socket.on('registerAdmin', () => {
    adminSockets.add(socket.id);
    console.log(`Admin registered: ${socket.id}`);
  });

  // register player
  socket.on('registerPlayer', (userId) => {
    playerSockets.set(userId, socket.id);
    const playerRoom = `player_${userId}`; // player-specific room
    socket.join(playerRoom);
    console.log(`Registered player ${userId} with socket ${socket.id} and joined room ${playerRoom}`);
  });

  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });


  // Player sends message — forward it to admin room 
socket.on('playerMessage', (data) => {
    console.log(`Player ${data.userId} sent message: ${data.text}`);
    adminSockets.forEach(adminSocketId => {
      io.to(adminSocketId).emit('userMessage', {
        senderId: data.userId,
        content: data.text
      });
    });
  });


  // Player registers their userId after connection
socket.on('adminReply', ({ toUserId, text }) => {
    const targetSocketId = playerSockets.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('adminMessage', { text });
      console.log(`Admin sent reply to player ${toUserId}: ${text}`);
    } else {
      console.log(`Player ${toUserId} is not online`);
    }
  });

 // Optional: Save chat message to DB and emit to room 
  socket.on('sendMessage', async ({ roomId, senderId, message }) => {
    const timestamp = new Date();
    try {
      await DB.query(
        `INSERT INTO messages_list (room_id, sender_id, message_text, timestamp) VALUES ($1, $2, $3, $4)`,
        [roomId, senderId, message, timestamp]
      );
      io.to(roomId).emit('newMessage', { senderId, message, timestamp });
      console.log(`Message saved and sent to room ${roomId} by sender ${senderId}`);
    } catch (err) {
      console.error('Failed to store message:', err);
    }
  });


  // Player sends a message to admin
  socket.on("playerMessage", (data) => {
    // Send only to admin sockets, not to the player socket itself
    adminSockets.forEach(adminSocketId => {
      io.to(adminSocketId).emit("adminMessage", {
        fromUserId: data.userId,
        text: data.text
      });
    });
  });

  // Admin replies to a specific player
  socket.on('adminReply', ({ toUserId, text }) => {
    const targetSocketId = playerSockets.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('adminMessage', { text });
      console.log(`Sent reply to player ${toUserId}`);
    } else {
      console.log(`Player ${toUserId} is not online`);
    }
  });


  socket.on('sendMessage', async ({ roomId, senderId, message }) => {
    const timestamp = new Date();
    try {
      await DB.query(
        `INSERT INTO messages_list (room_id, sender_id, message_text, timestamp) VALUES ($1, $2, $3, $4)`,
        [roomId, senderId, message, timestamp]
      );
      io.to(roomId).emit('newMessage', { senderId, message, timestamp });
    } catch (err) {
      console.error('Failed to store message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ───────────── Start Server ─────────────
httpServer.listen(PORT, () => {
  console.log(`catwalk-server running on http://localhost:${PORT}`);
});


