import express from 'express';
import DB from '../db.js';

const router = express.Router();

// 1. Get all tickets (with user info)
router.get('/', async (req, res) => {
    try {
        const result = await DB.query(`
        SELECT t.ticket_id, t.user_id, t.status, t.created_at, u.username
        FROM tickets_table t
        JOIN players u ON t.user_id = u.id
        ORDER BY t.created_at DESC
      `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// Create a new ticket for a user
router.post('/', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    try {
        const result = await DB.query(
            `INSERT INTO tickets_table (user_id) VALUES ($1) RETURNING *`,
            [user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// 2. Get messages by ticket_id
router.get('/:ticketId/messages', async (req, res) => {
    const ticketId = req.params.ticketId;
    try {
        const result = await DB.query(
            'SELECT sender, content, timestamp FROM messages_table WHERE ticket_id = $1 ORDER BY timestamp',
            [ticketId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// 3. Send a message to a ticket (via HTTP POST)
router.post('/:ticketId/messages', async (req, res) => {
    const ticketId = req.params.ticketId;
    const { sender, content } = req.body;
    try {
        await DB.query(
            'INSERT INTO messages_table (ticket_id, sender, content) VALUES ($1, $2, $3)',
            [ticketId, sender, content]
        );
        res.status(201).json({ message: 'Message saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save message' });
    }
});

router.get('/user/:userId/open', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    console.log('GET open ticket for userId:', userId);
    if (isNaN(userId)) {
        console.log('Invalid userId:', req.params.userId);
        return res.status(400).send('Invalid user ID');
    }

    try {
        const query = `
      SELECT * FROM tickets_table 
      WHERE user_id = $1 AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `;
        const { rows } = await DB.query(query, [userId]);
        console.log('Query result:', rows);
        // return res.status(200).json(rows);

        if (rows.length === 0) {
            return res.status(404).send('No open ticket found');
        }
        else {
            res.status(200).json(rows[0]);
        }
    } catch (error) {
        console.error('Error fetching open ticket:', error);
        res.status(500).send('Server error');
    }
});





router.get('/:ticketId', async (req, res) => {
    const ticketId = req.params.ticketId;

    try {
        // Query ticket info and join with users to get username
        const result = await DB.query(
            `SELECT t.ticket_id, t.status, t.created_at, t.updated_at, u.username, t.user_id
       FROM tickets_table t
       JOIN players u ON t.user_id = u.id
       WHERE t.ticket_id = $1`,
            [ticketId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching ticket:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Get all tickets for a user (open + closed)
router.get('/user/:userId/all', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).send('Invalid user ID');

    try {
        const result = await DB.query(
            `SELECT ticket_id, status, created_at, updated_at
       FROM tickets_table
       WHERE user_id = $1
       ORDER BY created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching user tickets:', err);
        res.status(500).send('Server error');
    }
});



// PATCH to close a ticket
router.patch('/:ticketId/close', async (req, res) => {
    const ticketId = parseInt(req.params.ticketId, 10);
    if (isNaN(ticketId)) return res.status(400).json({ error: 'Invalid ticket ID' });

    try {
        const result = await DB.query(
            `UPDATE tickets_table SET status = 'closed' WHERE ticket_id = $1 AND status = 'open' RETURNING *`,
            [ticketId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticket not found or already closed' });
        }

        const closedTicket = result.rows[0];
        io.emit('ticketClosed', { ticketId: closedTicket.ticket_id, userId: closedTicket.user_id });

        res.json({ message: 'Ticket closed successfully' });
    } catch (err) {
        console.error('Failed to close ticket:', err);
        res.status(500).json({ error: 'Failed to close ticket' });
    }
});

export default router;
// }
