import DB from '../../db.js';

// 1️⃣ Get all tickets (with username)
export const getAllTickets = async (_req, res) => {
  try {
    const result = await DB.query(`
      SELECT t.ticket_id, t.user_id, t.status, t.created_at, u.username
      FROM tickets_table t
      JOIN players u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// 2️⃣ Create a new ticket
export const createTicket = async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const result = await DB.query(
      `INSERT INTO tickets_table (user_id) VALUES ($1) RETURNING *`,
      [user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
};

// 3️⃣ Get ticket by ID
export const getTicketById = async (req, res) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  if (isNaN(ticketId)) return res.status(400).json({ error: 'Invalid ticket ID' });

  try {
    const result = await DB.query(`
      SELECT t.ticket_id, t.user_id, t.status, t.created_at, u.username
      FROM tickets_table t
      JOIN players u ON t.user_id = u.id
      WHERE t.ticket_id = $1
    `, [ticketId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching ticket by ID:', err);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
};

// 4️⃣ Get all tickets for a user
export const getUserTickets = async (req, res) => {
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
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching user tickets:', err);
    res.status(500).send('Server error');
  }
};

// 5️⃣ Get open ticket for a user
export const getUserOpenTicket = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).send('Invalid user ID');

  try {
    const { rows } = await DB.query(`
      SELECT * FROM tickets_table 
      WHERE user_id = $1 AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (rows.length === 0) return res.status(404).send('No open ticket found');
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching open ticket:', err);
    res.status(500).send('Server error');
  }
};

// 6️⃣ Get messages for a ticket
export const getTicketMessages = async (req, res) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  try {
    const result = await DB.query(
      'SELECT sender, content, timestamp FROM messages_table WHERE ticket_id = $1 ORDER BY timestamp',
      [ticketId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// 7️⃣ Send message to ticket
export const sendTicketMessage = async (req, res) => {
  const ticketId = parseInt(req.params.ticketId, 10);
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
};

// 8️⃣ Close ticket
export const closeTicket = async (req, res, io) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  if (isNaN(ticketId)) return res.status(400).json({ error: 'Invalid ticket ID' });

  try {
    const result = await DB.query(
      `UPDATE tickets_table 
       SET status = 'closed' 
       WHERE ticket_id = $1 AND status = 'open' 
       RETURNING *`,
      [ticketId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ticket not found or already closed' });
    }

    const closedTicket = result.rows[0];
    if (io) io.emit('ticketClosed', { ticketId: closedTicket.ticket_id, userId: closedTicket.user_id });

    res.status(200).json({ message: 'Ticket closed successfully' });
  } catch (err) {
    console.error('Failed to close ticket:', err);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
};

// 9️⃣ Test route (optional)
export const testTickets = async (_req, res) => {
  try {
    const { rows } = await DB.query('SELECT COUNT(*) FROM tickets_table');
    res.status(200).json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to count tickets' });
  }
};
