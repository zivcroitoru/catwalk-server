/*-----------------------------------------------------------------------------
  mailbox.js (SERVER) - Messages System for Cat Walk Game
  Handles real-time messaging via Socket.io
-----------------------------------------------------------------------------*/

import jwt from 'jsonwebtoken';

// Constants
const MAX_MESSAGE_LENGTH = 250;
const MAX_SUBJECT_LENGTH = 50;

/**
 * Setup mailbox functionality with Socket.io
 * @param {Object} io - Socket.io server instance
 * @param {Object} db - Database connection (e.g., sqlite, pg, etc.)
 * @param {string} jwtSecret - JWT secret for token verification
 */
export function setupMailbox(io, db, jwtSecret) {
  // Store connected players for targeted messaging
  const connectedPlayers = new Map(); // playerId -> socketId

  /**
   * Authenticate socket connection using JWT
   */
  function authenticate(socket, next) {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('No authentication token provided'));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid authentication token'));
    }
  }

  // Apply authentication middleware
  io.use(authenticate);

  /**
   * Database query functions
   */
  const queries = {
    // Get all tickets for a player
    async getPlayerTickets(playerId) {
      const sql = `
        SELECT t.*, 
               COUNT(CASE WHEN m.is_read = false AND m.sender_type = 'admin' THEN 1 END) as unread_messages
        FROM tickets t
        LEFT JOIN messages m ON t.id = m.ticket_id
        WHERE t.player_id = $1
        GROUP BY t.id
        ORDER BY t.last_activity_at DESC
      `;
      const result = await db.query(sql, [playerId]);
      return result.rows;
    },

    // Get broadcasts for a player with read status
    async getPlayerBroadcasts(playerId) {
      const sql = `
        SELECT b.*,
               COALESCE(pbr.is_read, false) as is_read
        FROM broadcasts b
        LEFT JOIN player_broadcast_reads pbr ON b.id = pbr.broadcast_id AND pbr.player_id = $1
        ORDER BY b.sent_at DESC
      `;
      const result = await db.query(sql, [playerId]);
      return result.rows;
    },

    // Get messages for a specific ticket
    async getTicketMessages(ticketId) {
      const sql = `
        SELECT m.*, 
               CASE 
                 WHEN m.sender_type = 'player' THEN p.username
                 WHEN m.sender_type = 'admin' THEN a.username
               END as sender_username
        FROM messages m
        LEFT JOIN players p ON m.sender_type = 'player' AND m.sender_id = p.id
        LEFT JOIN admins a ON m.sender_type = 'admin' AND m.sender_id = a.id
        WHERE m.ticket_id = $1
        ORDER BY m.sent_at ASC
      `;
      const result = await db.query(sql, [ticketId]);
      return result.rows;
    },

    // Create new ticket
    async createTicket(playerId, subject, body) {
      const now = new Date().toISOString();
      
      // Insert ticket
      const ticketResult = await db.query(`
        INSERT INTO tickets (player_id, subject, status, created_at, last_activity_at)
        VALUES ($1, $2, 'open', $3, $4)
        RETURNING id
      `, [playerId, subject, now, now]);

      const ticketId = ticketResult.rows[0].id;

      // Insert first message
      await db.query(`
        INSERT INTO messages (ticket_id, sender_type, sender_id, subject, body, is_read, sent_at)
        VALUES ($1, 'player', $2, $3, $4, true, $5)
      `, [ticketId, playerId, subject, body, now]);

      return {
        id: ticketId,
        player_id: playerId,
        subject,
        status: 'open',
        created_at: now,
        last_activity_at: now
      };
    },

    // Add message to existing ticket
    async addMessage(ticketId, senderType, senderId, body) {
      const now = new Date().toISOString();
      
      // Insert message
      const result = await db.query(`
        INSERT INTO messages (ticket_id, sender_type, sender_id, body, is_read, sent_at)
        VALUES ($1, $2, $3, $4, false, $5)
        RETURNING id
      `, [ticketId, senderType, senderId, body, now]);

      // Update ticket last activity
      await db.query(`
        UPDATE tickets SET last_activity_at = $1 WHERE id = $2
      `, [now, ticketId]);

      return {
        id: result.rows[0].id,
        ticket_id: ticketId,
        sender_type: senderType,
        sender_id: senderId,
        body,
        is_read: false,
        sent_at: now
      };
    },

    // Mark message as read/unread
    async markMessage(messageId, isRead) {
      await db.query(`
        UPDATE messages SET is_read = $1 WHERE id = $2
      `, [isRead, messageId]);
    },

    // Mark broadcast as read for player
    async markBroadcastRead(playerId, broadcastId) {
      await db.query(`
        INSERT INTO player_broadcast_reads (player_id, broadcast_id, is_read)
        VALUES ($1, $2, true)
        ON CONFLICT (player_id, broadcast_id) 
        DO UPDATE SET is_read = true
      `, [playerId, broadcastId]);
    },

    // Get unread counts
    async getUnreadCounts(playerId) {
      const ticketUnreads = await db.query(`
        SELECT COUNT(*) as count
        FROM messages m
        JOIN tickets t ON m.ticket_id = t.id
        WHERE t.player_id = $1 AND m.sender_type = 'admin' AND m.is_read = false
      `, [playerId]);

      const broadcastUnreads = await db.query(`
        SELECT COUNT(*) as count
        FROM broadcasts b
        LEFT JOIN player_broadcast_reads pbr ON b.id = pbr.broadcast_id AND pbr.player_id = $1
        WHERE pbr.is_read IS NULL OR pbr.is_read = false
      `, [playerId]);

      return {
        unread_tickets: parseInt(ticketUnreads.rows[0].count) || 0,
        unread_broadcasts: parseInt(broadcastUnreads.rows[0].count) || 0
      };
    }
  };

  /**
   * Helper functions
   */
  function notifyPlayer(playerId, eventName, data) {
    const socketId = connectedPlayers.get(playerId);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(eventName, data);
      }
    }
  }

  function notifyAllAdmins(eventName, data) {
    // Emit to admin room/namespace (assumes admins join 'admins' room)
    io.to('admins').emit(eventName, data);
  }

  /**
   * Socket connection handler
   */
  io.on('connection', async (socket) => {
    console.log(`📬 Player ${socket.username} (${socket.userId}) connected to mailbox`);
    
    // Store connection
    connectedPlayers.set(socket.userId, socket.id);

    // Send connection confirmation
    socket.emit('connection_confirmed');

    /**
     * Player requests mailbox data
     */
    socket.on('get_mailbox_data', async () => {
      try {
        const [tickets, broadcasts, unreadCounts] = await Promise.all([
          queries.getPlayerTickets(socket.userId),
          queries.getPlayerBroadcasts(socket.userId),
          queries.getUnreadCounts(socket.userId)
        ]);

        socket.emit('mailbox_data', {
          tickets,
          broadcasts,
          unread_tickets: unreadCounts.unread_tickets,
          unread_broadcasts: unreadCounts.unread_broadcasts
        });
      } catch (error) {
        console.error('Error getting mailbox data:', error);
        socket.emit('error', { message: 'Failed to load mailbox data' });
      }
    });

    /**
     * Player creates new ticket (Contact Us)
     */
    socket.on('create_ticket', async (data) => {
      try {
        const { subject, body } = data;

        // Validate input
        if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
          socket.emit('error', { message: 'Invalid subject length' });
          return;
        }
        if (!body || body.length > MAX_MESSAGE_LENGTH) {
          socket.emit('error', { message: 'Invalid message length' });
          return;
        }

        const ticket = await queries.createTicket(socket.userId, subject, body);
        
        socket.emit('ticket_created', { ticket });
        
        // Notify admins of new ticket
        notifyAllAdmins('new_ticket_notification', {
          ticket,
          player_username: socket.username
        });

      } catch (error) {
        console.error('Error creating ticket:', error);
        socket.emit('error', { message: 'Failed to create ticket' });
      }
    });

    /**
     * Player sends message to existing ticket
     */
    socket.on('send_message', async (data) => {
      try {
        const { ticket_id, body } = data;

        if (!body || body.length > MAX_MESSAGE_LENGTH) {
          socket.emit('error', { message: 'Invalid message length' });
          return;
        }

        const message = await queries.addMessage(ticket_id, 'player', socket.userId, body);
        
        socket.emit('message_sent', { message });

        // Notify admins of new message
        notifyAllAdmins('new_message_notification', {
          ticket_id,
          message,
          player_username: socket.username
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Player marks message as read/unread
     */
    socket.on('mark_message', async (data) => {
      try {
        const { message_id, is_read } = data;
        
        await queries.markMessage(message_id, is_read);
        
        socket.emit('message_status_update', {
          message_id,
          is_read
        });

      } catch (error) {
        console.error('Error marking message:', error);
        socket.emit('error', { message: 'Failed to update message status' });
      }
    });

    /**
     * Player marks broadcast as read
     */
    socket.on('mark_broadcast', async (data) => {
      try {
        const { broadcast_id } = data;
        
        await queries.markBroadcastRead(socket.userId, broadcast_id);
        
        socket.emit('broadcast_marked_read', { broadcast_id });

      } catch (error) {
        console.error('Error marking broadcast:', error);
        socket.emit('error', { message: 'Failed to mark broadcast as read' });
      }
    });

    /**
     * Get messages for specific ticket
     */
    socket.on('get_ticket_messages', async (data) => {
      try {
        const { ticket_id } = data;
        const messages = await queries.getTicketMessages(ticket_id);
        
        socket.emit('ticket_messages', {
          ticket_id,
          messages
        });

      } catch (error) {
        console.error('Error getting ticket messages:', error);
        socket.emit('error', { message: 'Failed to load ticket messages' });
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      console.log(`📬 Player ${socket.username} (${socket.userId}) disconnected from mailbox`);
      connectedPlayers.delete(socket.userId);
    });
  });

  /**
   * Admin functions (called from admin interface)
   */
  const adminFunctions = {
    // Admin sends broadcast to all players
    async sendBroadcast(adminId, adminUsername, subject, body) {
      try {
        const now = new Date().toISOString();
        
        const result = await db.query(`
          INSERT INTO broadcasts (admin_id, admin_username, subject, body, sent_at)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [adminId, adminUsername, subject, body, now]);

        const broadcast = {
          id: result.rows[0].id,
          admin_id: adminId,
          admin_username: adminUsername,
          subject,
          body,
          sent_at: now,
          is_read: false
        };

        // Send to all connected players
        io.emit('new_broadcast', { broadcast });
        
        return broadcast;
      } catch (error) {
        console.error('Error sending broadcast:', error);
        throw error;
      }
    },

    // Admin replies to ticket
    async replyToTicket(ticketId, adminId, body) {
      try {
        const message = await queries.addMessage(ticketId, 'admin', adminId, body);
        
        // Get ticket info to find player
        const ticketResult = await db.query('SELECT player_id FROM tickets WHERE id = $1', [ticketId]);
        
        if (ticketResult.rows.length > 0) {
          const ticket = ticketResult.rows[0];
          // Notify the specific player
          notifyPlayer(ticket.player_id, 'new_message', {
            ticket_id: ticketId,
            message
          });
        }

        return message;
      } catch (error) {
        console.error('Error replying to ticket:', error);
        throw error;
      }
    }
  };

  return adminFunctions;
}

export {
  setupMailbox,
  setupDatabase
};