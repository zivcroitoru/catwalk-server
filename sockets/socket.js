import DB from '../db.js';

// ═══════════════════════════════════════════════════════════════
// FASHION SHOW LOGIC (NEW)
// ═══════════════════════════════════════════════════════════════

// Constants
const PARTICIPANTS_IN_ROOM = 5;
const VOTING_TIMER = 60;

// Global waiting room singleton
let waitingRoom = {
  participants: [],
  isVoting: false
};

// ─────────────── Game Room Class ───────────────
class GameRoom {
  constructor(participants) {
    this.participants = participants;
    this.isVoting = true;
    this.votingStartTime = Date.now();
    this.isFinalized = false;
    this.votingTimer = null;

    console.log('🗳️ GameRoom created with participants:', this.participants.map(p => p.playerId));
    this.startVotingPhase();
  }

  startVotingPhase() {
    console.log('⏳ Voting phase started');

    this.participants.forEach(participant => {
      if (participant.socket?.connected) {
        participant.socket.emit('voting_phase', {
          type: 'voting_phase',
          participants: this.getParticipantsForClient(),
          timerSeconds: VOTING_TIMER
        });
        console.log(`📤 Sent voting_phase to ${participant.playerId}`);
      }
    });

    this.participants.forEach(participant => {
      if (participant.isDummy) {
        this.makeDummyVote(participant);
      }
    });

    this.votingTimer = setTimeout(() => {
      console.log('⏰ Voting timeout reached');
      this.handleVotingTimeout();
    }, VOTING_TIMER * 1000);
  }

  makeDummyVote(dummy) {
    const availableCats = this.participants.filter(p => p.catId !== dummy.catId).map(p => p.catId);
    if (availableCats.length > 0) {
      const choice = availableCats[Math.floor(Math.random() * availableCats.length)];
      console.log(`🤖 Dummy ${dummy.playerId} voting for ${choice}`);
      this.handleVote(dummy, choice);
    }
  }

  handleVote(voter, votedCatId) {
    if (this.isFinalized || votedCatId === voter.catId) return;

    voter.votedCatId = votedCatId;
    console.log(`🗳️ ${voter.playerId} voted for ${votedCatId}`);

    this.broadcastVotingUpdate();

    const allVoted = this.participants.every(p => p.votedCatId);
    if (allVoted) {
      console.log('✅ All participants voted. Finalizing...');
      this.finalizeVoting();
    }
  }

  handleVotingTimeout() {
    if (this.isFinalized) return;

    this.participants.forEach(participant => {
      if (!participant.votedCatId) {
        const availableCats = this.participants.filter(p => p.catId !== participant.catId).map(p => p.catId);
        if (availableCats.length > 0) {
          const choice = availableCats[Math.floor(Math.random() * availableCats.length)];
          participant.votedCatId = choice;
          console.log(`⚠️ Timeout vote for ${participant.playerId}: voted ${choice}`);
        }
      }
    });

    this.finalizeVoting();
  }

  finalizeVoting() {
    if (this.isFinalized) return;
    this.isFinalized = true;

    if (this.votingTimer) clearTimeout(this.votingTimer);

    this.calculateResults();

    this.participants.forEach(participant => {
      if (participant.socket?.connected) {
        participant.socket.emit('results', {
          type: 'results',
          participants: this.getParticipantsForClient()
        });
        console.log(`📤 Sent results to ${participant.playerId}`);
      }
    });
  }

  calculateResults() {
    const votes = {};
    this.participants.forEach(p => {
      if (p.votedCatId) {
        votes[p.votedCatId] = (votes[p.votedCatId] || 0) + 1;
      }
    });

    this.participants.forEach(p => {
      p.votesReceived = votes[p.catId] || 0;
      p.coinsEarned = p.votesReceived * 25;
      console.log(`💰 ${p.playerId} earned ${p.coinsEarned} coins with ${p.votesReceived} votes`);
    });
  }

  broadcastVotingUpdate() {
    this.participants.forEach(p => {
      if (p.socket?.connected) {
        p.socket.emit('voting_update', {
          type: 'voting_update',
          participants: this.getParticipantsForClient()
        });
        console.log(`🔄 Sent voting update to ${p.playerId}`);
      }
    });
  }

  getParticipantsForClient() {
    return this.participants.map(p => ({
      playerId: p.playerId,
      catId: p.catId,
      votedCatId: p.votedCatId,
      votesReceived: p.votesReceived || 0,
      coinsEarned: p.coinsEarned || 0
    }));
  }

  handleParticipantDisconnect(p) {
    if (this.isFinalized) return;

    if (!p.votedCatId) {
      const options = this.participants.filter(x => x.catId !== p.catId).map(x => x.catId);
      if (options.length > 0) {
        const vote = options[Math.floor(Math.random() * options.length)];
        p.votedCatId = vote;
        console.log(`⚠️ ${p.playerId} disconnected - voting randomly for ${vote}`);
        const allVoted = this.participants.every(p => p.votedCatId);
        allVoted ? this.finalizeVoting() : this.broadcastVotingUpdate();
      }
    }
  }
}

// ─────────────── Fashion Show Utilities ───────────────
function generateDummyParticipant() {
  const id = Math.random().toString(36).substr(2, 9);
  const dummy = {
    playerId: `dummy_${id}`,
    catId: `cat_${id}`,
    isDummy: true,
    socket: null
  };
  console.log(`👻 Generated dummy: ${dummy.playerId}`);
  return dummy;
}

function broadcastWaitingRoomUpdate() {
  waitingRoom.participants.forEach(p => {
    if (p.socket?.connected) {
      p.socket.emit('participant_update', {
        type: 'participant_update',
        participants: waitingRoom.participants.map(p => ({
          playerId: p.playerId,
          catId: p.catId
        })),
        maxCount: PARTICIPANTS_IN_ROOM
      });
      console.log(`📤 Sent waiting room update to ${p.playerId}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN SOCKET SETUP FUNCTION (UPDATED)
// ═══════════════════════════════════════════════════════════════

export default function setupSocket(io) {
  // Track player and admin sockets (EXISTING TICKET LOGIC)
  const playerSockets = new Map();
  const adminSockets = new Set();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ═══════════════════════════════════════════════════════════════
    // FASHION SHOW SOCKET HANDLERS (NEW)
    // ═══════════════════════════════════════════════════════════════

    let currentRoom = null;
    let participant = null;

    socket.on('join', (message) => {
      console.log('🎭 Fashion Show - Received join message:', message);

      if (!message.playerId || !message.catId) {
        console.warn('⚠️ Fashion Show - Missing playerId or catId. Disconnecting.');
        return socket.disconnect();
      }

      participant = {
        playerId: message.playerId,
        catId: message.catId,
        socket,
        isDummy: false
      };
      console.log(`✅ Fashion Show - Registered: ${participant.playerId} (${participant.catId})`);

      if (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM && !waitingRoom.isVoting) {
        waitingRoom.participants.push(participant);
        currentRoom = waitingRoom;

        console.log(`👥 Fashion Show - Waiting room: ${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM}`);

        // REMOVED: Auto-fill with dummies for testing
        // We want real players only in the waiting room

        broadcastWaitingRoomUpdate();

        // Only launch game room when we have exactly 5 REAL participants
        if (waitingRoom.participants.length === PARTICIPANTS_IN_ROOM) {
          console.log('🚀 Fashion Show - Launching game room with 5 real players');
          const gameRoom = new GameRoom([...waitingRoom.participants]);

          waitingRoom.participants.forEach(p => {
            if (!p.isDummy && p.socket) p.socket.gameRoom = gameRoom;
          });

          currentRoom = gameRoom;

          waitingRoom = {
            participants: [],
            isVoting: false
          };
        }
      } else {
        console.warn('❌ Fashion Show - Waiting room full or voting. Disconnecting.');
        socket.disconnect();
      }
    });

    socket.on('vote', (message) => {
      console.log('🗳️ Fashion Show - Received vote:', message);
      if (currentRoom instanceof GameRoom && participant) {
        currentRoom.handleVote(participant, message.votedCatId);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // EXISTING TICKET SYSTEM HANDLERS (UNCHANGED)
    // ═══════════════════════════════════════════════════════════════


    //broadcast/////////////

    socket.on("adminBroadcast", async ({ message, adminId }) => {
  try {
    // 1️⃣ Save broadcast in DB
    const insertResult = await DB.query(
      `INSERT INTO broadcasts (admin_id, body) VALUES ($1, $2) RETURNING *`,
      [adminId, message]
    );

    const savedBroadcast = insertResult.rows[0];

    // 2️⃣ Get all player IDs
    const result = await DB.query("SELECT id FROM players");

    // 3️⃣ Send broadcast to each player
    result.rows.forEach(row => {
      io.to(`user_${row.id}`).emit("adminBroadcast", {
        message: savedBroadcast.body,
        date: savedBroadcast.sent_at
      });
    });

    // 4️⃣ Notify all admins that broadcast was sent
    io.to("admins").emit("broadcastSent", { message: savedBroadcast.body, count: result.rows.length });

  } catch (err) {
    console.error("Error sending broadcast:", err);
    socket.emit("errorMessage", { message: "Failed to send broadcast." });
  }
});

////////////////////////


    // Admin registers
    socket.on('registerAdmin', () => {
      adminSockets.add(socket.id);
      socket.join('admins');
      console.log(`Admin registered and joined admins room: ${socket.id}`);
    });

    // Player registers and joins all their open ticket rooms
    socket.on('registerPlayer', async (userId) => {
      socket.join(`user_${userId}`);

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

          const newTicket = insertResult.rows[0];

          // To notify all admins of new ticket
          io.to('admins').emit('newTicketCreated', newTicket);

          callback({ ticket: newTicket });
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

    // ═══════════════════════════════════════════════════════════════
    // DISCONNECT HANDLER (UPDATED TO HANDLE BOTH SYSTEMS)
    // ═══════════════════════════════════════════════════════════════

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Handle fashion show disconnect
      if (participant) {
        if (currentRoom === waitingRoom) {
          const idx = waitingRoom.participants.indexOf(participant);
          if (idx > -1) {
            waitingRoom.participants.splice(idx, 1);
            broadcastWaitingRoomUpdate();
            console.log(`👤 Fashion Show - ${participant.playerId} left waiting room`);
          }
        } else if (currentRoom instanceof GameRoom) {
          currentRoom.handleParticipantDisconnect(participant);
          console.log(`👤 Fashion Show - ${participant.playerId} disconnected during game`);
        }
      }

      // Existing admin socket cleanup
      adminSockets.delete(socket.id);

      // Existing player socket cleanup
      for (const [userId, socketId] of playerSockets.entries()) {
        if (socketId === socket.id) {
          playerSockets.delete(userId);
          break;
        }
      }
    });
  });
}