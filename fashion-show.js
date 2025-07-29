import { Server } from "socket.io";

export function initFashionShowConfig(mainHttpServer) {
  const io = new Server(mainHttpServer, {
    cors: {
      origin: "*"
    }
  });

  // Socket.io connection handling
  io.on('connection', newIoCSocket);
}


// Constants
const PARTICIPANTS_IN_ROOM = 5;
const VOTING_TIMER = 60;

// Global waiting room singleton
let waitingRoom = {
  participants: [],
  isVoting: false
};

// Room class for active games
class GameRoom {
  constructor(participants) {
    this.participants = participants;
    this.isVoting = true;
    this.votingStartTime = Date.now();
    this.isFinalized = false;
    this.votingTimer = null;
    
    // Start voting phase
    this.startVotingPhase();
  }

  startVotingPhase() {
    // Send voting phase message to all participants
    this.participants.forEach(participant => {
      if (participant.socket && participant.socket.connected) {
        participant.socket.emit('voting_phase', {
          type: 'voting_phase',
          participants: this.getParticipantsForClient(),
          timerSeconds: VOTING_TIMER
        });
      }
    });

    // Make dummy participants vote immediately
    this.participants.forEach(participant => {
      if (participant.isDummy) {
        this.makeDummyVote(participant);
      }
    });

    // Start voting timer
    this.votingTimer = setTimeout(() => {
      this.handleVotingTimeout();
    }, VOTING_TIMER * 1000);
  }

  makeDummyVote(dummyParticipant) {
    // Get all cats except the dummy's own cat
    const availableCats = this.participants
      .filter(p => p.catId !== dummyParticipant.catId)
      .map(p => p.catId);
    
    if (availableCats.length > 0) {
      const randomCatId = availableCats[Math.floor(Math.random() * availableCats.length)];
      this.handleVote(dummyParticipant, randomCatId);
    }
  }

  handleVote(participant, votedCatId) {
    if (this.isFinalized) return;

    // Validate vote (can't vote for own cat)
    if (votedCatId === participant.catId) return;

    // Update participant's vote
    participant.votedCatId = votedCatId;

    // Send voting update to all participants
    this.broadcastVotingUpdate();

    // Check if all participants have voted
    const allVoted = this.participants.every(p => p.votedCatId);
    if (allVoted) {
      this.finalizeVoting();
    }
  }

  handleVotingTimeout() {
    if (this.isFinalized) return;

    // Make random votes for participants who haven't voted
    this.participants.forEach(participant => {
      if (!participant.votedCatId) {
        const availableCats = this.participants
          .filter(p => p.catId !== participant.catId)
          .map(p => p.catId);
        
        if (availableCats.length > 0) {
          const randomCatId = availableCats[Math.floor(Math.random() * availableCats.length)];
          participant.votedCatId = randomCatId;
        }
      }
    });

    this.finalizeVoting();
  }

  finalizeVoting() {
    if (this.isFinalized) return;
    
    this.isFinalized = true;
    
    // Clear voting timer
    if (this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
    }

    // Calculate results
    this.calculateResults();

    // Send results to all participants
    this.participants.forEach(participant => {
      if (participant.socket && participant.socket.connected) {
        participant.socket.emit('results', {
          type: 'results',
          participants: this.getParticipantsForClient()
        });
      }
    });
  }

  calculateResults() {
    // Count votes for each cat
    const voteCounts = {};
    this.participants.forEach(participant => {
      if (participant.votedCatId) {
        voteCounts[participant.votedCatId] = (voteCounts[participant.votedCatId] || 0) + 1;
      }
    });

    // Calculate coins for each participant
    this.participants.forEach(participant => {
      const votesReceived = voteCounts[participant.catId] || 0;
      participant.votesReceived = votesReceived;
      participant.coinsEarned = votesReceived * 25;
    });
  }

  broadcastVotingUpdate() {
    this.participants.forEach(participant => {
      if (participant.socket && participant.socket.connected) {
        participant.socket.emit('voting_update', {
          type: 'voting_update',
          participants: this.getParticipantsForClient()
        });
      }
    });
  }

  getParticipantsForClient() {
    // Return participants without isDummy field and socket reference
    return this.participants.map(p => ({
      playerId: p.playerId,
      catId: p.catId,
      votedCatId: p.votedCatId,
      votesReceived: p.votesReceived || 0,
      coinsEarned: p.coinsEarned || 0
    }));
  }

  handleParticipantDisconnect(disconnectedParticipant) {
    if (this.isFinalized) return;

    // If participant hasn't voted yet, make a random vote for them
    if (!disconnectedParticipant.votedCatId) {
      const availableCats = this.participants
        .filter(p => p.catId !== disconnectedParticipant.catId)
        .map(p => p.catId);
      
      if (availableCats.length > 0) {
        const randomCatId = availableCats[Math.floor(Math.random() * availableCats.length)];
        disconnectedParticipant.votedCatId = randomCatId;
        
        // Check if all participants have now voted
        const allVoted = this.participants.every(p => p.votedCatId);
        if (allVoted) {
          this.finalizeVoting();
        } else {
          this.broadcastVotingUpdate();
        }
      }
    }
  }
}

function generateDummyParticipant() {
  return {
    playerId: `dummy_${Math.random().toString(36).substr(2, 9)}`,
    catId: `cat_${Math.random().toString(36).substr(2, 9)}`,
    isDummy: true,
    socket: null
  };
}

function broadcastWaitingRoomUpdate() {
  waitingRoom.participants.forEach(participant => {
    if (participant.socket && participant.socket.connected) {
      participant.socket.emit('participant_update', {
        type: 'participant_update',
        participants: waitingRoom.participants.map(p => ({
          playerId: p.playerId,
          catId: p.catId
        })),
        maxCount: PARTICIPANTS_IN_ROOM
      });
    }
  });
}

/** A new socket.io connection is opened */
function newIoCSocket(socket) {
  console.log('🔌 New client connected:', socket.id);
  
  let currentRoom = null;
  let participant = null;

  socket.on('join', (message) => {
    console.log('📨 Received join message:', message);

    participant = {
      playerId: message.playerId,
      catId: message.catId,
      socket: socket,
      isDummy: false
    };

    // Add to waiting room if it's not full and not in voting phase
    if (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM && !waitingRoom.isVoting) {
      waitingRoom.participants.push(participant);
      currentRoom = waitingRoom;
      
      console.log(`👥 Player ${participant.playerId} joined waiting room (${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM})`);
      
      // Fill remaining slots with dummies if needed
      while (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM) {
        const dummy = generateDummyParticipant();
        waitingRoom.participants.push(dummy);
      }

      // Broadcast participant update
      broadcastWaitingRoomUpdate();

      // If room is now full, start the game
      if (waitingRoom.participants.length === PARTICIPANTS_IN_ROOM) {
        console.log('🎮 Starting new game room');
        
        // Create new game room with current participants
        const gameRoom = new GameRoom([...waitingRoom.participants]);
        
        // Update current room reference for all real participants
        waitingRoom.participants.forEach(p => {
          if (!p.isDummy && p.socket) {
            // This is a bit of a hack - we store the room reference in the socket
            p.socket.gameRoom = gameRoom;
          }
        });
        
        // Update current room for this participant
        currentRoom = gameRoom;
        
        // Reset waiting room
        waitingRoom = {
          participants: [],
          isVoting: false
        };
      }
    } else {
      // Waiting room is full or in voting phase, disconnect the client
      console.log('❌ Waiting room is full or in voting phase, disconnecting client');
      socket.disconnect();
    }
  });

  socket.on('vote', (message) => {
    console.log('📨 Received vote message:', message);
    if (currentRoom && currentRoom instanceof GameRoom && participant) {
      currentRoom.handleVote(participant, message.votedCatId);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    
    if (participant) {
      if (currentRoom === waitingRoom) {
        // Remove from waiting room
        const index = waitingRoom.participants.indexOf(participant);
        if (index > -1) {
          waitingRoom.participants.splice(index, 1);
          broadcastWaitingRoomUpdate();
          console.log(`👥 Player ${participant.playerId} left waiting room`);
        }
      } else if (currentRoom instanceof GameRoom) {
        // Handle disconnect during voting phase
        currentRoom.handleParticipantDisconnect(participant);
        console.log(`👥 Player ${participant.playerId} disconnected during voting`);
      }
    }
  });
}
