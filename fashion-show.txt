// // import { Server } from "socket.io";

// export function initFashionShowConfig(mainHttpServer) {
//   const io = new Server(mainHttpServer, {
//     cors: {
//       origin: "*"
//     }
//   });

//   console.log('🧵 Socket.io server initialized');

//   io.on('connection', newIoCSocket);
// }

// // Constants
// const PARTICIPANTS_IN_ROOM = 5;
// const VOTING_TIMER = 60;

// // Global waiting room singleton
// let waitingRoom = {
//   participants: [],
//   isVoting: false
// };

// // ─────────────── Game Room Class ───────────────
// class GameRoom {
//   constructor(participants) {
//     this.participants = participants;
//     this.isVoting = true;
//     this.votingStartTime = Date.now();
//     this.isFinalized = false;
//     this.votingTimer = null;

//     console.log('🗳️ GameRoom created with participants:', this.participants.map(p => p.playerId));
//     this.startVotingPhase();
//   }

//   startVotingPhase() {
//     console.log('⏳ Voting phase started');

//     this.participants.forEach(participant => {
//       if (participant.socket?.connected) {
//         participant.socket.emit('voting_phase', {
//           type: 'voting_phase',
//           participants: this.getParticipantsForClient(),
//           timerSeconds: VOTING_TIMER
//         });
//         console.log(`📤 Sent voting_phase to ${participant.playerId}`);
//       }
//     });

//     this.participants.forEach(participant => {
//       if (participant.isDummy) {
//         this.makeDummyVote(participant);
//       }
//     });

//     this.votingTimer = setTimeout(() => {
//       console.log('⏰ Voting timeout reached');
//       this.handleVotingTimeout();
//     }, VOTING_TIMER * 1000);
//   }

//   makeDummyVote(dummy) {
//     const availableCats = this.participants.filter(p => p.catId !== dummy.catId).map(p => p.catId);
//     if (availableCats.length > 0) {
//       const choice = availableCats[Math.floor(Math.random() * availableCats.length)];
//       console.log(`🤖 Dummy ${dummy.playerId} voting for ${choice}`);
//       this.handleVote(dummy, choice);
//     }
//   }

//   handleVote(voter, votedCatId) {
//     if (this.isFinalized || votedCatId === voter.catId) return;

//     voter.votedCatId = votedCatId;
//     console.log(`🗳️ ${voter.playerId} voted for ${votedCatId}`);

//     this.broadcastVotingUpdate();

//     const allVoted = this.participants.every(p => p.votedCatId);
//     if (allVoted) {
//       console.log('✅ All participants voted. Finalizing...');
//       this.finalizeVoting();
//     }
//   }

//   handleVotingTimeout() {
//     if (this.isFinalized) return;

//     this.participants.forEach(participant => {
//       if (!participant.votedCatId) {
//         const availableCats = this.participants.filter(p => p.catId !== participant.catId).map(p => p.catId);
//         if (availableCats.length > 0) {
//           const choice = availableCats[Math.floor(Math.random() * availableCats.length)];
//           participant.votedCatId = choice;
//           console.log(`⚠️ Timeout vote for ${participant.playerId}: voted ${choice}`);
//         }
//       }
//     });

//     this.finalizeVoting();
//   }

//   finalizeVoting() {
//     if (this.isFinalized) return;
//     this.isFinalized = true;

//     if (this.votingTimer) clearTimeout(this.votingTimer);

//     this.calculateResults();

//     this.participants.forEach(participant => {
//       if (participant.socket?.connected) {
//         participant.socket.emit('results', {
//           type: 'results',
//           participants: this.getParticipantsForClient()
//         });
//         console.log(`📤 Sent results to ${participant.playerId}`);
//       }
//     });
//   }

//   calculateResults() {
//     const votes = {};
//     this.participants.forEach(p => {
//       if (p.votedCatId) {
//         votes[p.votedCatId] = (votes[p.votedCatId] || 0) + 1;
//       }
//     });

//     this.participants.forEach(p => {
//       p.votesReceived = votes[p.catId] || 0;
//       p.coinsEarned = p.votesReceived * 25;
//       console.log(`💰 ${p.playerId} earned ${p.coinsEarned} coins with ${p.votesReceived} votes`);
//     });
//   }

//   broadcastVotingUpdate() {
//     this.participants.forEach(p => {
//       if (p.socket?.connected) {
//         p.socket.emit('voting_update', {
//           type: 'voting_update',
//           participants: this.getParticipantsForClient()
//         });
//         console.log(`🔄 Sent voting update to ${p.playerId}`);
//       }
//     });
//   }

//   getParticipantsForClient() {
//     return this.participants.map(p => ({
//       playerId: p.playerId,
//       catId: p.catId,
//       votedCatId: p.votedCatId,
//       votesReceived: p.votesReceived || 0,
//       coinsEarned: p.coinsEarned || 0
//     }));
//   }

//   handleParticipantDisconnect(p) {
//     if (this.isFinalized) return;

//     if (!p.votedCatId) {
//       const options = this.participants.filter(x => x.catId !== p.catId).map(x => x.catId);
//       if (options.length > 0) {
//         const vote = options[Math.floor(Math.random() * options.length)];
//         p.votedCatId = vote;
//         console.log(`⚠️ ${p.playerId} disconnected - voting randomly for ${vote}`);
//         const allVoted = this.participants.every(p => p.votedCatId);
//         allVoted ? this.finalizeVoting() : this.broadcastVotingUpdate();
//       }
//     }
//   }
// }

// // ─────────────── Utilities ───────────────
// function generateDummyParticipant() {
//   const id = Math.random().toString(36).substr(2, 9);
//   const dummy = {
//     playerId: `dummy_${id}`,
//     catId: `cat_${id}`,
//     isDummy: true,
//     socket: null
//   };
//   console.log(`👻 Generated dummy: ${dummy.playerId}`);
//   return dummy;
// }

// function broadcastWaitingRoomUpdate() {
//   waitingRoom.participants.forEach(p => {
//     if (p.socket?.connected) {
//       p.socket.emit('participant_update', {
//         type: 'participant_update',
//         participants: waitingRoom.participants.map(p => ({
//           playerId: p.playerId,
//           catId: p.catId
//         })),
//         maxCount: PARTICIPANTS_IN_ROOM
//       });
//       console.log(`📤 Sent waiting room update to ${p.playerId}`);
//     }
//   });
// }

// // ─────────────── Socket Handler ───────────────
// function newIoCSocket(socket) {
//   console.log('🔌 New client connected:', socket.id);

//   let currentRoom = null;
//   let participant = null;

//   socket.on('join', (message) => {
//     console.log('📨 Received join message:', message);

//     if (!message.playerId || !message.catId) {
//       console.warn('⚠️ Missing playerId or catId. Disconnecting.');
//       return socket.disconnect();
//     }

//     participant = {
//       playerId: message.playerId,
//       catId: message.catId,
//       socket,
//       isDummy: false
//     };
//     console.log(`✅ Registered: ${participant.playerId} (${participant.catId})`);

//     if (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM && !waitingRoom.isVoting) {
//       waitingRoom.participants.push(participant);
//       currentRoom = waitingRoom;

//       console.log(`👥 Waiting room: ${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM}`);

//       while (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM) {
//         waitingRoom.participants.push(generateDummyParticipant());
//       }

//       broadcastWaitingRoomUpdate();

//       if (waitingRoom.participants.length === PARTICIPANTS_IN_ROOM) {
//         console.log('🚀 Launching game room');
//         const gameRoom = new GameRoom([...waitingRoom.participants]);

//         waitingRoom.participants.forEach(p => {
//           if (!p.isDummy && p.socket) p.socket.gameRoom = gameRoom;
//         });

//         currentRoom = gameRoom;

//         waitingRoom = {
//           participants: [],
//           isVoting: false
//         };
//       }
//     } else {
//       console.warn('❌ Waiting room full or voting. Disconnecting.');
//       socket.disconnect();
//     }
//   });

//   socket.on('vote', (message) => {
//     console.log('🗳️ Received vote:', message);
//     if (currentRoom instanceof GameRoom && participant) {
//       currentRoom.handleVote(participant, message.votedCatId);
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('🔌 Disconnected:', socket.id);

//     if (participant) {
//       if (currentRoom === waitingRoom) {
//         const idx = waitingRoom.participants.indexOf(participant);
//         if (idx > -1) {
//           waitingRoom.participants.splice(idx, 1);
//           broadcastWaitingRoomUpdate();
//           console.log(`👤 ${participant.playerId} left waiting room`);
//         }
//       } else if (currentRoom instanceof GameRoom) {
//         currentRoom.handleParticipantDisconnect(participant);
//         console.log(`👤 ${participant.playerId} disconnected during game`);
//       }
//     }
//   });
// }
