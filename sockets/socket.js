import DB from '../db.js';

export default function setupSocket(io) {
  // Track player and admin sockets
  const playerSockets = new Map();
  const adminSockets = new Set();



  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Admin registers
    socket.on('registerAdmin', () => {
      adminSockets.add(socket.id);
      console.log(`Admin registered: ${socket.id}`);
    });
    // Player registers and joins all their open ticket rooms
    socket.on('registerPlayer', async (userId) => {
      playerSockets.set(userId, socket.id);
      console.log(`Registered player ${userId} with socket ${socket.id}`);

      try {
        const result = await DB.query(
          `SELECT ticket_id FROM tickets_table WHERE user_id = $1 AND status = 'open'`,
          [userId]
        );
        result.rows.forEach(row => {
          const ticketRoom = `ticket_${row.ticket_id}`;
          socket.join(ticketRoom);
          console.log(`Player socket joined ticket room: ${ticketRoom}`);
        });
      } catch (err) {
        console.error('Failed to get player tickets:', err);
      }
    });

    // Admin joins a ticket room
    socket.on('joinTicketRoom', ({ ticketId }) => {
      const roomName = `ticket_${ticketId}`;
      socket.join(roomName);
      console.log(`Admin socket ${socket.id} joined ticket room: ${roomName}`);
    });

    // Player sends message
    socket.on('playerMessage', async ({ ticketId, userId, text }) => {
      const roomName = `ticket_${ticketId}`;
      console.log(`Player ${userId} sent message for ticket ${ticketId}: ${text}`);

      try {
        await DB.query(
          `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'user', $2, NOW())`,
          [ticketId, text]
        );
      } catch (err) {
        console.error('Error saving message:', err);
      }

      io.to(roomName).emit('newMessage', {
        sender: 'user',
        content: text,
        ticketId,
        userId
      });
    });

    // Player opens ticket
    socket.on('openTicketRequest', async ({ userId }, callback) => {
      try {
        const result = await DB.query(
          `SELECT * FROM tickets_table WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        if (result.rows.length > 0) {
          callback({ ticket: result.rows[0] });
        } else {
          const insertResult = await DB.query(
            `INSERT INTO tickets_table (user_id, status) VALUES ($1, 'open') RETURNING *`,
            [userId]
          );
          callback({ ticket: insertResult.rows[0] });
        }
      } catch (err) {
        console.error('Error in openTicketRequest:', err);
        callback({ error: 'Failed to open or create ticket' });
      }
    });

    // Admin sends message
    socket.on('adminMessage', async ({ ticketId, text }) => {
      const roomName = `ticket_${ticketId}`;
      console.log(`Admin sent message to ticket ${ticketId}: ${text}`);

      try {
        await DB.query(
          `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'admin', $2, NOW())`,
          [ticketId, text]
        );
      } catch (err) {
        console.error('Error saving message:', err);
      }

      io.to(roomName).emit('newMessage', {
        sender: 'admin',
        content: text,
        ticketId
      });
    });

    // Admin closes ticket via socket
    socket.on('closeTicket', async ({ ticketId }) => {
      try {
        // Update DB
        await DB.query(
          `UPDATE tickets_table SET status = 'closed' WHERE ticket_id = $1`,
          [ticketId]
        );

        console.log(`Ticket ${ticketId} closed by admin.`);

        // Broadcast to all in that ticket room
        io.to(`ticket_${ticketId}`).emit('ticketClosed', { ticketId });

      } catch (err) {
        console.error('Error closing ticket:', err);
        socket.emit('errorMessage', { message: 'Failed to close ticket.' });
      }
    });


    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}
