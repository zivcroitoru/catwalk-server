// import express from 'express';
// import http from 'http';
// import { Server } from 'socket.io';
// import cors from 'cors';
// import session from 'express-session';
// import dotenv from 'dotenv';

// dotenv.config();

// import DB from './db.js'; // Adjust this import to your setup
// import authRoutes from './routes/auth.js';
// import catsRoutes from './routes/cats.js';
// import playersRoutes from './routes/players.js';
// import shopRoutes from './routes/shop.js';

// const app = express();
// const server = http.createServer(app);

// const allowedOrigins = ['http://127.0.0.1:5500'];

// app.use(cors({
//   origin: (origin, callback) => {
//     // Allow requests with no origin (like mobile apps or curl) or from allowed origins
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
// }));

// app.use(express.json());

// app.use(session({
//   secret: process.env.SESSION_SECRET || 'secretcatwalkcookie',
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: false, // true if using HTTPS in production
//     httpOnly: true,
//     maxAge: 1000 * 60 * 60 * 24, // 1 day
//   }
// }));

// // Routes
// app.use('/auth', authRoutes);
// app.use('/cats', catsRoutes);
// app.use('/players', playersRoutes);
// app.use('/shop', shopRoutes);

// // Test API endpoint
// app.get('/api/test', async (req, res) => {
//   try {
//     const response = await DB.query('SELECT * FROM users');
//     console.log(response.rows);
//     res.json({ message: 'Hello from server' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'DB query error' });
//   }
// });

// app.get('/api/wow', async (req, res) => {
//   try {
//     const response = await DB.query('SELECT * FROM users');
//     if (response.rows.length === 0) {
//       return res.status(200).send('Not found');
//     }
//     res.status(200).send(response.rows);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('ERROR');
//   }
// });

// // Initialize Socket.IO server with CORS config
// const io = new Server(server, {
//   cors: {
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     methods: ['GET', 'POST'],
//     credentials: true,
//   }
// });

// io.on('connection', (socket) => {
//   console.log('User connected:', socket.id);

//   // Example welcome message
//   socket.emit('welcome', 'Welcome to the CatWalk socket server!');

//   socket.on('message', (msg) => {
//     console.log('Received message:', msg);
//     socket.broadcast.emit('message', msg);
//   });

//   socket.on('disconnect', () => {
//     console.log('User disconnected:', socket.id);
//   });
// });

// const PORT = 3000;
// server.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });
