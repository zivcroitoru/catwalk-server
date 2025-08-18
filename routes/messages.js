// //eoutes/messages.js

// import express from 'express';
// import DB from '../db.js';

// const router = express.Router();

// // Get all messages for a room
// router.get('/:roomId/messages', async (req, res) => {
//   const { roomId } = req.params;

//   try {
//     const result = await DB.query(
//       `SELECT * FROM messages_list WHERE room_id = $1 ORDER BY timestamp ASC`,
//       [roomId]
//     );

//     res.status(200).json(result.rows);
//   } catch (err) {
//     console.error('Failed to fetch messages:', err);
//     res.status(500).json({ error: 'Failed to fetch messages' });
//   }
// });

// // In messages.js or a new route file
// router.get('/rooms', async (req, res) => {
//   try {
//     // Return distinct room IDs from messages_list table
//     const result = await DB.query('SELECT DISTINCT room_id FROM messages_list');
//     res.status(200).json(result.rows.map(r => r.room_id));
//   } catch (err) {
//     console.error('Failed to fetch rooms:', err);
//     res.status(500).json({ error: 'Failed to fetch rooms' });
//   }
// });


// // GET all chat users (for the admin)
// router.get('/users', async (req, res) => {
//   try {
//     const result = await DB.query('SELECT id, username FROM players ORDER BY id');
//     res.status(200).json(result.rows);
//   } catch (err) {
//     console.error('Error fetching users for admin:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // radmin send message
// router.post("/admin/send", async (req, res) => {
//   const { room_id, sender_id, message_text } = req.body;
//   try {
//     const result = await DB.query(
//       "INSERT INTO messages_list (room_id, sender_id, message_text) VALUES ($1, $2, $3) RETURNING *",
//       [room_id, sender_id, message_text]
//     );
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error("Error saving message:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// // Get messages between admin and a specific user
// router.get('/:userId', async (req, res) => {
//   const { userId } = req.params;
//   const room_id = `admin_user_${userId}`; // same format used in .post('/send')

//   try {
//     const result = await DB.query(
//       `SELECT * FROM messages_list WHERE room_id = $1 ORDER BY timestamp ASC`,
//       [room_id]
//     );
//     res.status(200).json(result.rows);
//   } catch (err) {
//     console.error('Failed to fetch messages for user:', err);
//     res.status(500).json({ error: 'Failed to fetch user messages' });
//   }
// });


// // POST /api/messages/send
// router.post('/send', async (req, res) => {
//   const { receiverId, content } = req.body;

//   try {
//     const room_id = `admin_user_${receiverId}`; // or however you're forming room IDs
//     const sender_id = 0; // use 0 or a fixed ID for admin

//     await db.query(
//       `INSERT INTO messages_list (room_id, sender_id, message_text) VALUES ($1, $2, $3)`,
//       [room_id, sender_id, content]
//     );

//     res.status(201).json({ success: true });
//   } catch (err) {
//     console.error('Error saving admin message:', err);
//     res.status(500).json({ error: 'Failed to save message' });
//   }
// });


// // router.get('/broadcasts', async (req, res) => {
// //   console.log("GET /broadcasts route hit");   // <-- check if this prints
// //   try {
// //     const result = await DB.query('SELECT * FROM public.broadcasts');
// //     res.status(200).json(result.rows);
// //     console.log('DB rows:', result.rows);    // <-- check what the DB returns
// //   } catch (err) {
// //     console.error('Failed to fetch broadcasts:', err);
// //     res.status(500).json({ error: 'Failed to fetch broadcasts' });
// //   }
// // });



// // // Save a broadcast
// // router.post('/broadcasts', async (req, res) => {
// //   try {
// //     const { message } = req.body;
// //     if (!message) {
// //       return res.status(400).json({ error: 'Message is required' });
// //     }

// //     const result = await DB.query(
// //       'INSERT INTO broadcasts (body) VALUES ($1) RETURNING *',
// //       [message]
// //     );

// //     // Just return the inserted row, no Socket.IO emit
// //     return res.status(201).json(result.rows[0]);

// //   } catch (err) {
// //     console.error('Error saving broadcast:', err);
// //     return res.status(500).json({ error: 'Failed to save broadcast' });
// //   }
// // });


// router.get('/test', (req, res) => {
//   console.log("GET /test hit");
//   res.json({ ok: true });
// });



// export default router;
