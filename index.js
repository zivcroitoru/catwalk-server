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

// ───────────── Routes (your existing routes here) ─────────────
// For example:
import ticketsRoutes from './routes/tickets.js';
app.use('/api/tickets', ticketsRoutes);

// ───────────── Socket.IO Setup ─────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Register player socket
  socket.on('registerPlayer', (userId) => {
    console.log(`Player registered: userId=${userId}, socketId=${socket.id}`);
  });

  // Handle request to open or create ticket
  socket.on('openTicketRequest', async ({ userId }, callback) => {
    console.log('openTicketRequest received for userId:', userId);
    try {
      const result = await DB.query(
        `SELECT * FROM tickets_table WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      console.log('DB query result:', result.rows);

      if (result.rows.length > 0) {
        console.log('Returning existing open ticket');
        callback({ ticket: result.rows[0] });
      } else {
        console.log('Creating new ticket');
        const insertResult = await DB.query(
          `INSERT INTO tickets_table (user_id, status) VALUES ($1, 'open') RETURNING *`,
          [userId]
        );
        console.log('New ticket created:', insertResult.rows[0]);
        callback({ ticket: insertResult.rows[0] });
      }
    } catch (err) {
      console.error('Error in openTicketRequest:', err);
      callback({ error: 'Failed to open or create ticket' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ───────────── Start Server ─────────────
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});









// import './utils.js'; // Load environment variables
// import express from 'express';
// import cors from 'cors';
// import DB from './db.js';
// import http from 'http';
// import { Server as SocketIOServer } from 'socket.io';

// // ───────────── App Setup ─────────────
// const app = express();
// const PORT = process.env.PORT || 3001;

// // ───────────── HTTP Server Setup ─────────────
// const httpServer = http.createServer(app);

// // ───────────── CORS Config ─────────────
// const allowedOrigins = [
//   'http://localhost:3000',
//   'https://catwalk.onrender.com',
//   process.env.FRONTEND_URL
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, origin);
//     } else {
//       callback(new Error('Not allowed by CORS: ' + origin));
//     }
//   },
//   credentials: true
// }));

// // ───────────── Middleware ─────────────
// app.use(express.json());

// // ───────────── Routes ─────────────
// import authRoutes from './routes/auth.js';
// import messagesRoutes from './routes/messages.js';
// import catsRoutes from './routes/cats.js';
// import playersRoutes from './routes/players.js';
// import shopRoutes from './routes/shop.js';
// import adminRoutes from './routes/admins.js';
// import player_itemsRoutes from './routes/player_items.js';
// import catItemsRoutes from './routes/cat_items.js';
// import mailboxRoutes from './routes/mailbox.js';
// import ticketsRoutes from './routes/tickets.js';

// app.use('/auth', authRoutes);
// app.use('/api/cats', catsRoutes);
// app.use('/api/cat_items', catItemsRoutes);
// app.use('/api/players', playersRoutes);
// app.use('/api/shop', shopRoutes);
// app.use('/api/admins', adminRoutes);
// app.use('/api/playerItems', player_itemsRoutes);
// app.use('/api/messages', messagesRoutes);
// app.use('/api/mailbox', mailboxRoutes);
// app.use('/api/tickets', ticketsRoutes);


// // ───────────── Test Routes ─────────────
// app.get('/api/test', async (req, res) => {
//   const response = await DB.query("SELECT * FROM players");
//   console.log(response.rows);
//   res.json({ message: 'Hello from server' });
// });

// app.get('/api/wow', async (req, res) => {
//   try {
//     const response = await DB.query("SELECT * FROM players");
//     if (response.rows.length === 0) {
//       return res.status(200).send("Not found");
//     }
//     res.status(200).send(response.rows);
//   } catch (error) {
//     console.error(error);
//     res.status(404).send("ERROR");
//   }
// });



// // ───────────── Socket.IO Setup ─────────────
// const io = new SocketIOServer(httpServer, {
//   cors: {
//     origin: allowedOrigins,
//     credentials: true
//   }
// });

// // Map to track player userId to socket id
// const playerSockets = new Map();
// const adminSockets = new Set();


// function removeSocketFromMaps(socket) {
//   adminSockets.delete(socket.id);

//   for (const [userId, sId] of playerSockets.entries()) {
//     if (sId === socket.id) {
//       playerSockets.delete(userId);
//       break;
//     }
//   }
// }

// io.on('connection', (socket) => {
//   console.log('User connected:', socket.id)


//   // Admin registers
//   socket.on('registerAdmin', () => {
//     adminSockets.add(socket.id);
//     console.log(`Admin registered: ${socket.id}`);
//   });

//   // Register player and join all their open ticket rooms
//   socket.on('registerPlayer', async (userId) => {
//     playerSockets.set(userId, socket.id);
//     console.log(`Registered player ${userId} with socket ${socket.id}`);

//     // Fetch all open tickets for this player from DB
//     try {
//       const result = await DB.query(
//         `SELECT ticket_id FROM tickets_table WHERE user_id = $1 AND status = 'open'`,
//         [userId]
//       );
//       result.rows.forEach(row => {
//         const ticketRoom = `ticket_${row.ticket_id}`;
//         socket.join(ticketRoom);
//         console.log(`Player socket joined ticket room: ${ticketRoom}`);
//       });
//     } catch (err) {
//       console.error('Failed to get player tickets:', err);
//     }
//   });


//   // Admin joins a ticket room when they select a ticket
//   socket.on('joinTicketRoom', ({ ticketId }) => {
//     const roomName = `ticket_${ticketId}`;
//     socket.join(roomName);
//     console.log(`Admin socket ${socket.id} joined ticket room: ${roomName}`);
//   });


//   // Player sends message for a ticket room
//   socket.on('playerMessage', async ({ ticketId, userId, text }) => {
//     const roomName = `ticket_${ticketId}`;
//     console.log(`Player ${userId} sent message for ticket ${ticketId}: ${text}`);

//     // Save message to DB (optional)
//     try {
//       await DB.query(
//         `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'user', $2, NOW())`,
//         [ticketId, text]
//       );
//     } catch (err) {
//       console.error('Error saving message:', err);
//     }

//     // Emit to admin sockets in that ticket room
//     io.to(roomName).emit('newMessage', {
//       sender: 'user',
//       content: text,
//       ticketId,
//       userId
//     });
//   });


//   socket.on('openTicketRequest', async ({ userId }, callback) => {
//     try {
//       // Check if user has an open ticket
//       const result = await DB.query(
//         `SELECT * FROM tickets_table WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
//         [userId]
//       );

//       if (result.rows.length > 0) {
//         // Return existing open ticket
//         callback({ ticket: result.rows[0] });
//       } else {
//         // Create new ticket
//         const insertResult = await DB.query(
//           `INSERT INTO tickets_table (user_id, status) VALUES ($1, 'open') RETURNING *`,
//           [userId]
//         );
//         callback({ ticket: insertResult.rows[0] });
//       }
//     } catch (err) {
//       console.error('Error in openTicketRequest:', err);
//       callback({ error: 'Failed to open or create ticket' });
//     }
//   });


//   // Admin sends message to a ticket room
//   socket.on('adminMessage', async ({ ticketId, text }) => {
//     const roomName = `ticket_${ticketId}`;
//     console.log(`Admin sent message to ticket ${ticketId}: ${text}`);

//     // Save message to DB
//     try {
//       await DB.query(
//         `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'admin', $2, NOW())`,
//         [ticketId, text]
//       );
//     } catch (err) {
//       console.error('Error saving message:', err);
//     }

//     // Emit to all in that ticket room (player + admins)
//     io.to(roomName).emit('newMessage', {
//       sender: 'admin',
//       content: text,
//       ticketId
//     });
//   });


//   socket.on('disconnect', () => {
//     console.log('User disconnected:', socket.id);
//   });
// });

// // ───────────── Start Server ─────────────
// httpServer.listen(PORT, () => {
//   console.log(`catwalk-server running on http://localhost:${PORT}`);
// });