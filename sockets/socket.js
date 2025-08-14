import DB from '../db.js';
// socket.js
export let io;
export function init(server) {
  io = new Server(server);
}

// ═══════════════════════════════════════════════════════════════
// FASHION SHOW LOGIC (ENHANCED)
// ═══════════════════════════════════════════════════════════════

// Constants
const PARTICIPANTS_IN_ROOM = 2;
const VOTING_TIMER = 60;

// Global waiting room singleton
let waitingRoom = {
  participants: [],
  isVoting: false
};

// ─────────────── Enhanced Participant Creation ───────────────
async function createParticipant(playerId, catId, socket) {
  console.log(`🔍 STEP 1A - Fetching data for player ${playerId}, cat ${catId}`);
  
  // Start with basic participant structure
  const participant = {
    playerId,
    catId,
    socket,
    isDummy: false,
    username: `Player_${playerId}`, // fallback
    catName: `Cat_${catId}` // fallback
  };

  try {
    // STEP 1A-1: Fetch player data from database
    console.log(`🔍 STEP 1A-1 - Querying players table for id=${playerId}`);
    const playerResult = await DB.query(
      'SELECT id, username FROM players WHERE id = $1',
      [playerId]
    );
    
    console.log(`🔍 STEP 1A-1 - Player query result:`, playerResult.rows);
    
    if (playerResult.rows.length > 0) {
      const playerRow = playerResult.rows[0];
      if (playerRow.username) {
        participant.username = playerRow.username;
        console.log(`✅ STEP 1A-1 - Found username: ${participant.username}`);
      } else {
        console.log(`⚠️ STEP 1A-1 - Player ${playerId} has null/empty username, using fallback`);
      }
    } else {
      console.log(`⚠️ STEP 1A-1 - No player found with id ${playerId}, using fallback`);
    }

    // STEP 1A-2: Fetch cat data from database
    console.log(`🔍 STEP 1A-2 - Querying player_cats table for cat_id=${catId}, player_id=${playerId}`);
    const catResult = await DB.query(
      'SELECT cat_id, player_id, name, template FROM player_cats WHERE cat_id = $1 AND player_id = $2',
      [catId, playerId]
    );
    
    console.log(`🔍 STEP 1A-2 - Cat query result:`, catResult.rows);
    
    if (catResult.rows.length > 0) {
      const catRow = catResult.rows[0];
      if (catRow.name) {
        participant.catName = catRow.name;
        console.log(`✅ STEP 1A-2 - Found cat name: ${participant.catName}`);
      } else {
        console.log(`⚠️ STEP 1A-2 - Cat ${catId} has null/empty name, using fallback`);
      }
      console.log(`📊 STEP 1A-2 - Cat details: template=${catRow.template}`);
    } else {
      console.log(`⚠️ STEP 1A-2 - No cat found with cat_id=${catId} and player_id=${playerId}`);
      
      // DEBUG: Let's see what cats this player actually has
      console.log(`🔍 STEP 1A-2 DEBUG - Checking all cats for player ${playerId}:`);
      const debugResult = await DB.query(
        'SELECT cat_id, player_id, name, template FROM player_cats WHERE player_id = $1',
        [playerId]
      );
      console.log(`🔍 STEP 1A-2 DEBUG - Found ${debugResult.rows.length} cats:`, debugResult.rows);
      
      // Additional debug: Check if the cat exists at all
      console.log(`🔍 STEP 1A-2 DEBUG - Checking if cat ${catId} exists anywhere:`);
      const catExistsResult = await DB.query(
        'SELECT cat_id, player_id, name FROM player_cats WHERE cat_id = $1',
        [catId]
      );
      console.log(`🔍 STEP 1A-2 DEBUG - Cat ${catId} exists:`, catExistsResult.rows);
    }

  } catch (err) {
    console.error(`❌ STEP 1A ERROR - Failed to fetch data for player ${playerId}, cat ${catId}:`, err);
    console.error(`❌ STEP 1A ERROR - Error details:`, err.message);
    // Keep using fallback values
  }

  // STEP 1A-3: Final participant summary
  console.log(`✅ STEP 1A-3 - Final participant created:`, {
    playerId: participant.playerId,
    catId: participant.catId,
    username: participant.username,
    catName: participant.catName,
    isDummy: participant.isDummy
  });

  return participant;
}

// ─────────────── Game Room Class (Enhanced) ───────────────
class GameRoom {
  constructor(participants) {
    this.participants = participants;
    this.isVoting = true;
    this.votingStartTime = Date.now();
    this.isFinalized = false;
    this.votingTimer = null;

    console.log('🗳️ GameRoom created with participants:', this.participants.map(p => `${p.username} (${p.catName})`));
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
        console.log(`📤 Sent voting_phase to ${participant.username}`);
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
      console.log(`🤖 Dummy ${dummy.username} voting for cat ${choice}`);
      this.handleVote(dummy, choice);
    }
  }

  handleVote(voter, votedCatId) {
    if (this.isFinalized || votedCatId === voter.catId) return;

    voter.votedCatId = votedCatId;
    console.log(`🗳️ ${voter.username} voted for cat ${votedCatId}`);

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
          console.log(`⚠️ Timeout vote for ${participant.username}: voted for cat ${choice}`);
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
        console.log(`📤 Sent results to ${participant.username}`);
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
      console.log(`💰 ${p.username} (${p.catName}) earned ${p.coinsEarned} coins with ${p.votesReceived} votes`);
    });
  }

  broadcastVotingUpdate() {
    this.participants.forEach(p => {
      if (p.socket?.connected) {
        p.socket.emit('voting_update', {
          type: 'voting_update',
          participants: this.getParticipantsForClient()
        });
        console.log(`🔄 Sent voting update to ${p.username}`);
      }
    });
  }

  getParticipantsForClient() {
    return this.participants.map(p => ({
      playerId: p.playerId,
      catId: p.catId,
      username: p.username,      // ← Now included!
      catName: p.catName,        // ← Now included!
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
        console.log(`⚠️ ${p.username} disconnected - voting randomly for cat ${vote}`);
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
    username: `Dummy_${id}`,
    catName: `DummyCat_${id}`,
    isDummy: true,
    socket: null
  };
  console.log(`👻 Generated dummy: ${dummy.username} (${dummy.catName})`);
  return dummy;
}

function broadcastWaitingRoomUpdate() {
  console.log(`📤 STEP 1E - Broadcasting waiting room update to ${waitingRoom.participants.length} participants`);
  
  // Prepare the data to send to clients
  const participantsForClient = waitingRoom.participants.map(p => ({
    playerId: p.playerId,
    catId: p.catId,
    username: p.username,    // ← Now included!
    catName: p.catName       // ← Now included!
  }));
  
  console.log(`📤 STEP 1E - Participants data being sent to clients:`, participantsForClient);
  
  const updateMessage = {
    type: 'participant_update',
    participants: participantsForClient,
    maxCount: PARTICIPANTS_IN_ROOM
  };
  
  console.log(`📤 STEP 1E - Complete update message:`, updateMessage);

  waitingRoom.participants.forEach((participant, index) => {
    if (participant.socket?.connected) {
      console.log(`📤 STEP 1E - Sending update to participant ${index + 1}: ${participant.username} (socket: ${participant.socket.id})`);
      participant.socket.emit('participant_update', updateMessage);
    } else {
      console.warn(`⚠️ STEP 1E - Participant ${index + 1} (${participant.username}) has no connected socket`);
    }
  });
  
  console.log(`✅ STEP 1E - Waiting room update broadcast complete`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN SOCKET SETUP FUNCTION (ENHANCED)
// ═══════════════════════════════════════════════════════════════

export default function setupSocket(io) {
  // Track player and admin sockets (EXISTING TICKET LOGIC)
  const playerSockets = new Map();
  const adminSockets = new Set();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ═══════════════════════════════════════════════════════════════
    // FASHION SHOW SOCKET HANDLERS (ENHANCED)
    // ═══════════════════════════════════════════════════════════════

    let currentRoom = null;
    let participant = null;

    // ─────────────── ENHANCED Join Handler ───────────────
    socket.on('join', async (message) => {
      console.log('🎭 STEP 1B - Fashion Show received join message:', message);

      if (!message.playerId || !message.catId) {
        console.warn('⚠️ STEP 1B - Missing playerId or catId. Disconnecting.');
        console.warn('⚠️ STEP 1B - Received:', { playerId: message.playerId, catId: message.catId });
        return socket.disconnect();
      }

      console.log(`🎯 STEP 1B - Valid join request: playerId=${message.playerId}, catId=${message.catId}`);

      // STEP 1A: Create enhanced participant with full data from database
      console.log(`🔄 STEP 1A - Creating participant for player ${message.playerId} with cat ${message.catId}`);
      participant = await createParticipant(message.playerId, message.catId, socket);
      
      console.log(`✅ STEP 1A - Participant created successfully:`, {
        playerId: participant.playerId,
        catId: participant.catId,
        username: participant.username,
        catName: participant.catName
      });

      // STEP 1C: Check if waiting room is available
      console.log(`🔍 STEP 1C - Checking waiting room status:`);
      console.log(`🔍 STEP 1C - Current participants: ${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM}`);
      console.log(`🔍 STEP 1C - Is voting: ${waitingRoom.isVoting}`);
      
      if (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM && !waitingRoom.isVoting) {
        // STEP 1D: Add to waiting room
        waitingRoom.participants.push(participant);
        currentRoom = waitingRoom;

        console.log(`👥 STEP 1D - Added to waiting room: ${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM}`);
        console.log(`👥 STEP 1D - Current participants in room:`);
        waitingRoom.participants.forEach((p, index) => {
          console.log(`  ${index + 1}. ${p.username} (playerId: ${p.playerId}) with ${p.catName} (catId: ${p.catId})${p.isDummy ? ' [DUMMY]' : ''}`);
        });

        // STEP 1E: Broadcast waiting room update
        console.log(`📤 STEP 1E - Broadcasting waiting room update to all participants`);
        broadcastWaitingRoomUpdate();

        // STEP 1F: Check if room is full and ready for voting
        if (waitingRoom.participants.length === PARTICIPANTS_IN_ROOM) {
          console.log(`🚀 STEP 1F - Room is full! Launching game room with ${PARTICIPANTS_IN_ROOM} players`);
          console.log(`🚀 STEP 1F - Final participant list:`);
          waitingRoom.participants.forEach((p, index) => {
            console.log(`  ${index + 1}. ${p.username} with ${p.catName}${p.isDummy ? ' [DUMMY]' : ''}`);
          });
          
          const gameRoom = new GameRoom([...waitingRoom.participants]);

          waitingRoom.participants.forEach(p => {
            if (!p.isDummy && p.socket) p.socket.gameRoom = gameRoom;
          });

          currentRoom = gameRoom;

          // Reset waiting room for next round
          waitingRoom = {
            participants: [],
            isVoting: false
          };
          console.log(`🔄 STEP 1F - Waiting room reset for next round`);
        }
      } else {
        console.warn('❌ STEP 1C - Cannot join: Waiting room full or voting in progress');
        console.warn('❌ STEP 1C - Current state:', {
          participantCount: waitingRoom.participants.length,
          maxParticipants: PARTICIPANTS_IN_ROOM,
          isVoting: waitingRoom.isVoting
        });
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

// Admin sends a broadcast
socket.on("adminBroadcast", async ({ message }) => {
  try {
    // 1. Save broadcast to DB
    const insertResult = await DB.query(
      `INSERT INTO broadcasts (body) VALUES ($1) RETURNING *`,
      [message]
    );

    const broadcast = insertResult.rows[0];

    // 2. Emit broadcast to all players
    const playersResult = await DB.query("SELECT id FROM players");
    playersResult.rows.forEach(row => {
      io.to(`user_${row.id}`).emit("adminBroadcast", {
        message: broadcast.body,
        date: broadcast.sent_at
      });
    });

    // 3. Notify all admins that broadcast was sent
    io.to("admins").emit("broadcastSent", {
      message: broadcast.body,
      date: broadcast.sent_at,
      count: playersResult.rows.length
    });

  } catch (err) {
    console.error("Error sending broadcast:", err);
    socket.emit("errorMessage", { message: "Failed to send broadcast." });
  }
});


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
            console.log(`👤 Fashion Show - ${participant.username} left waiting room`);
          }
        } else if (currentRoom instanceof GameRoom) {
          currentRoom.handleParticipantDisconnect(participant);
          console.log(`👤 Fashion Show - ${participant.username} disconnected during game`);
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