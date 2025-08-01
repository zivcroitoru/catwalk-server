/*-----------------------------------------------------------------------------
  mailbox.js (HTTP ROUTES) - Messages System for Cat Walk Game
  Handles messaging via standard HTTP API
-----------------------------------------------------------------------------*/

import express from 'express';
import jwt from 'jsonwebtoken';
import DB from '../db.js';

const router = express.Router();

// Constants
const MAX_MESSAGE_LENGTH = 250;
const MAX_SUBJECT_LENGTH = 50;

/**
 * JWT Authentication Middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid authentication token' });
  }
}

/**
 * Admin Authentication Middleware
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check if user is admin (you might need to adjust this based on your JWT structure)
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminId = decoded.userId;
    req.adminUsername = decoded.username;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid authentication token' });
  }
}

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
    const result = await DB.query(sql, [playerId]);
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
    const result = await DB.query(sql, [playerId]);
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
    const result = await DB.query(sql, [ticketId]);
    return result.rows;
  },

  // Create new ticket
  async createTicket(playerId, subject, body) {
    const now = new Date().toISOString();
    
    // Insert ticket
    const ticketResult = await DB.query(`
      INSERT INTO tickets (player_id, subject, status, created_at, last_activity_at)
      VALUES ($1, $2, 'open', $3, $4)
      RETURNING id
    `, [playerId, subject, now, now]);

    const ticketId = ticketResult.rows[0].id;

    // Insert first message
    await DB.query(`
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
    const result = await DB.query(`
      INSERT INTO messages (ticket_id, sender_type, sender_id, body, is_read, sent_at)
      VALUES ($1, $2, $3, $4, false, $5)
      RETURNING id
    `, [ticketId, senderType, senderId, body, now]);

    // Update ticket last activity
    await DB.query(`
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
    await DB.query(`
      UPDATE messages SET is_read = $1 WHERE id = $2
    `, [isRead, messageId]);
  },

  // Mark broadcast as read for player
  async markBroadcastRead(playerId, broadcastId) {
    await DB.query(`
      INSERT INTO player_broadcast_reads (player_id, broadcast_id, is_read)
      VALUES ($1, $2, true)
      ON CONFLICT (player_id, broadcast_id) 
      DO UPDATE SET is_read = true
    `, [playerId, broadcastId]);
  },

  // Get unread counts
  async getUnreadCounts(playerId) {
    const ticketUnreads = await DB.query(`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN tickets t ON m.ticket_id = t.id
      WHERE t.player_id = $1 AND m.sender_type = 'admin' AND m.is_read = false
    `, [playerId]);

    const broadcastUnreads = await DB.query(`
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

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/mailbox - Get all mailbox data for authenticated player
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [tickets, broadcasts, unreadCounts] = await Promise.all([
      queries.getPlayerTickets(req.userId),
      queries.getPlayerBroadcasts(req.userId),
      queries.getUnreadCounts(req.userId)
    ]);

    res.json({
      success: true,
      data: {
        tickets,
        broadcasts,
        unread_tickets: unreadCounts.unread_tickets,
        unread_broadcasts: unreadCounts.unread_broadcasts
      }
    });
  } catch (error) {
    console.error('Error getting mailbox data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load mailbox data' 
    });
  }
});

/**
 * POST /api/mailbox/tickets - Create new ticket (Contact Us)
 */
router.post('/tickets', authenticateToken, async (req, res) => {
  try {
    const { subject, body } = req.body;

    // Validate input
    if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid subject length' 
      });
    }
    if (!body || body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid message length' 
      });
    }

    const ticket = await queries.createTicket(req.userId, subject, body);
    
    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create ticket' 
    });
  }
});

/**
 * POST /api/mailbox/tickets/:ticketId/messages - Send message to existing ticket
 */
router.post('/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { body } = req.body;

    if (!body || body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid message length' 
      });
    }

    const message = await queries.addMessage(ticketId, 'player', req.userId, body);
    
    res.json({
      success: true,
      data: { message }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send message' 
    });
  }
});

/**
 * GET /api/mailbox/tickets/:ticketId/messages - Get messages for specific ticket
 */
router.get('/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const messages = await queries.getTicketMessages(ticketId);
    
    res.json({
      success: true,
      data: {
        ticket_id: ticketId,
        messages
      }
    });

  } catch (error) {
    console.error('Error getting ticket messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load ticket messages' 
    });
  }
});

/**
 * PUT /api/mailbox/messages/:messageId - Mark message as read/unread
 */
router.put('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { is_read } = req.body;
    
    await queries.markMessage(messageId, is_read);
    
    res.json({
      success: true,
      data: {
        message_id: messageId,
        is_read
      }
    });

  } catch (error) {
    console.error('Error marking message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update message status' 
    });
  }
});

/**
 * PUT /api/mailbox/broadcasts/:broadcastId - Mark broadcast as read
 */
router.put('/broadcasts/:broadcastId', authenticateToken, async (req, res) => {
  try {
    const { broadcastId } = req.params;
    
    await queries.markBroadcastRead(req.userId, broadcastId);
    
    res.json({
      success: true,
      data: { broadcast_id: broadcastId }
    });

  } catch (error) {
    console.error('Error marking broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark broadcast as read' 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/mailbox/admin/broadcasts - Admin sends broadcast to all players
 */
router.post('/admin/broadcasts', authenticateAdmin, async (req, res) => {
  try {
    const { subject, body } = req.body;
    const now = new Date().toISOString();
    
    const result = await DB.query(`
      INSERT INTO broadcasts (admin_id, admin_username, subject, body, sent_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [req.adminId, req.adminUsername, subject, body, now]);

    const broadcast = {
      id: result.rows[0].id,
      admin_id: req.adminId,
      admin_username: req.adminUsername,
      subject,
      body,
      sent_at: now
    };
    
    res.json({
      success: true,
      data: { broadcast }
    });

  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send broadcast' 
    });
  }
});

/**
 * POST /api/mailbox/admin/tickets/:ticketId/reply - Admin replies to ticket
 */
router.post('/admin/tickets/:ticketId/reply', authenticateAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { body } = req.body;
    
    const message = await queries.addMessage(ticketId, 'admin', req.adminId, body);
    
    res.json({
      success: true,
      data: { message }
    });

  } catch (error) {
    console.error('Error replying to ticket:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reply to ticket' 
    });
  }
});

export default router;