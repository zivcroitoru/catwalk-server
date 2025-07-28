# cat walk - a fashion show matchmaking system

## 1. User-story
1. The player registers/ signs up to our website
2. The player arrives to the main page- the cat album
	- The player has playerId (string), and playerCats (a list of owned cats)
	- Each cat has playerId, and CatId
	- For now, the userId and catId are the *only* information we need (later, we will add extra fields for them - but not now)
3. The player selects a cat from the album, and enters the fashion show
4. The player arrives at the "waiting room" (we enter the waiting-room phase). The "?/5 players" will increase by 1 
5. If player wishes to quit the fashion show during the "waiting room" phase the player will return to cat album. The "?/5 players" will decrease by 1 
6. The player waits until the room is full with 5 participants (unless the player is the 5th one of course)
	- From the moment the first player entered the waiting room, a countdown of 20 seconds starts, we will add random dummy cats as participants (with random attributes) to immediately fill up the room to 5 participants if needed.
7. Then all 5 participants are moved to the next phase- the "voting" phase.
	-	A participant is Player + PlayerCat + votedCatId
8. A 60 seconds timer begins to run
8. The player sees all 5 playerCats
9. The player can click on a cat on the screen to vote for
	1. votedCatId starts as NULL
		1. What is a vote update? If player changes vote to another cat. votedCatId = the new catId player clicked on *instead* of the previous one. A player can update there vote so long as they are in the voting phase (N/5 players voted, N < 5)
		2. The player's own cat will be shown on screen just like the others, but this cat will not be clickable for the player (the owner of the cat)
	2. The players will be able too see: "5/5 players voted" once every votedCatId != NULL.
	3. The player can either vote for a cat and wait for all the other players to vote as well, or wait until timer ends
9. The players will be able too see: "N/5 players voted".
10. The voting phase will end once 1 of this 2 conditions are reached:
	1. All 5/5 players have voted
	2. Timer has reached it's end
11. Once the voting phase ends, the players are moved to the "rewards distribution" phase
12. In the "rewards distribution" phase the players can see how many coins each one got rewarded with
	- How coin distribution works: The cat that has been voted for by N players, gets N * 25 coins.
13. The player can now choose if to "play again" (sends player waiting room, the cycle starts once again) or "go home" (sends player back to album)
15. If player wishes to quit the fashion show during the *voting phase* the player will be able to. If this happens, the other players will be "unaware" of this: 
	1. A copy dummy of the player's cat will stay in the room 
	2. The dummy cat will immediately cast a random vote
	3. Other players can still vote for this cat 
	4. When reaching the "rewards distribution" phase - if the dummy earned coins, they will not be saved and added the the original player's data.
16. Connection drops: If player's connection drops during the voting phase, then player is moved to album (they should be able to join a new game if they want to, assuming they have connection), same dummy logic. Player cannot reconnect to the same game
17. The players will not be aware of the existence of dummies as dummies, this is so that the player's playing experience won't we ruined. The client should not know if a participant is a dummy

## 2. Messages
- client enters show: open WS (init msg: player + cat)
- server -> client: update participants count
- server -> client: enter voting phase
- server -> client: update voting count
- server -> client: results (and close WS)
- client -> server: vote

## 3. TypeScript types and constants - common to server and client

```typescript

const PARTICIPANTS_IN_ROOM = 5;
const WAITING_ROOM_TIMER = 20;
const VOTING_TIMER = 60;

type Participant = {
  playerId: string;
  catId: string;
  isDummy?: boolean; // Only for server-side logic, never sent to client

  // Only after the participant voted:
  votedCatId?: string;

  // Only after all the participants voted:
  votesReceived: number;
  coinsEarned: number;
}

// Client to Server - when a participant joins the waiting room
type JoinShowMessage = {
  type: 'join';
  playerId: string;
  catId: string;
}

// Client to Server - when a participant votes
type VotingMessage = {
  type: 'vote';
  votedCatId: string;
}

// Server to Client - when a participant joins the waiting room
type ParticipantUpdateMessage = {
  type: 'participant_update';
  participants: Participant[];
  maxCount: typeof PARTICIPANTS_IN_ROOM;
  timerSeconds: number; // up to WAITING_ROOM_TIMER
}

// Server to Client - when voting phase begins
type VotingPhaseMessage = {
  type: 'voting_phase';
  participants: Participant[];
  timerSeconds: typeof VOTING_TIMER;
}

// Server to Client - when a participant votes
type VotingUpdateMessage = {
  type: 'voting_update';
  participants: Participant[];
}

// Server to Client - when results are being calculated and distributed (results phase begins)
type ResultsMessage = {
  type: 'results';
  participants: Participant[];
}

```

## 4. SERVER pseudo code
Go over my pseudo code for the server side. DO NOT IMPLEMENT. tell me if I missed anything.
Return back to me this code + your commenting

```typescript
// WebSocket server setup (pseudo code)
wsServer.on('connection', (ws) => {
	let room;
	let us; // Participant

	// Handle message from client.
	ws.on('message', (message) => {
		switch (message.type) {
		case 'join':
			handleJoin(message);
			break;
		case 'vote':
			this.handleVote(message);
			break;
		}
	});

  ws.on('close', () => {
	// If the room's phase is 'waiting' - then remove us from the room's participants.
	if (room.phase === 'waiting') {	
		const ourIndexInRoom = room.participants.indexOf(us);
		if (ourIndexInRoom === -1) {
			throw new Error('Cant find us in room');
		}
		room.participants.splice(ourIndexInRoom, 1);
		return;
	}
	

		// Broadcast updated participant count to remaining players
		// Cancel waiting room timer if room becomes empty

	}

	// Else (the room is in phase 'voting') - then immediately vote a random cat (and mark us as dummy)
	us.isDummy = true;
	// Filter available cats (exclude our own catId)
	let randomVotedCatId; // select a random cat-id that is not our's
	handleVote({
		type: 'vote',
		votedCatId: randomVotedCatId,
	});
  });


  function handleJoin(message) {
	room = waitingRoom;
	us = {
		playerId: message.playerId,
		catId: message.catId,
	};
	room.participants.push(us);

	// If this is the first participant, set up a timer to create dummy participants.

	// MISSING: Check if room.participants.length === 1, then start timer
	// MISSING: setTimeout(WAITING_ROOM_TIMER * 1000, () => {
	//   if (room.phase === 'waiting') {
	//     fillWithDummies();
	//     startVotingPhase();
	//   }
	// });

	// when the waiting time is exhausted, and only if the phase is 'waiting', then create as many dummy participants as needed,
	//  by pushing to room.participants (isDummy=true), and also calling handleVote() for each.

	// If this participant filled-up the final place - start voting immediately and create a new waitingRoom.
	// MISSING: if (room.participants.length === PARTICIPANTS_IN_ROOM) {
	//   cancelWaitingTimer();
	//   startVotingPhase();
	//   createNewWaitingRoom();
	// }

	// Broadcast the message 'participant_update' to all the participants' clients.
	// Broadcast implementation - send ParticipantUpdateMessage to all room participants


  }

  function handleVote(message) {
	us.votedCatId = message.votedCatId;

	// Check if all participants already voted: if so - finalize the room.
	if (room.participants.every((participant) => participant.votedCatId !== undefined)) {
		// MISSING: Cancel voting timer
		finalizeRoom();
		return;
	}

	// Else - broadcast the message 'voting_update' to all the participants' clients.
	// MISSING: Send VotingUpdateMessage to all participants in room
  }

  function finalizeRoom() {
	// Calculate scores and coins, and broadcast to all clients.
	// Calculate scores and coins, and broadcast to all clients.
	// MISSING: Vote counting logic
	// MISSING: room.participants.forEach(p => {
	//   p.votesReceived = room.participants.filter(voter => voter.votedCatId === p.catId).length;
	//   p.coinsEarned = p.votesReceived * 25;
	// });
	// MISSING: Send ResultsMessage to all participants
	// MISSING: Close WebSocket connections or wait for client disconnect
  }

  function broadcastMessage(message) {

  }
});

```


## 5. CLIENT pseudo code
Write a TS canvas pseudo code for the client side


## 6. Additional notes
- This project should be as simple שד possible, we're not "looking for more work". 
- Timer updates: The server sends to the client the value of the timer, and the clients handle the countdown locally. We won't send periodic sync updates
- Error handling: As for now, we will not be adding error message types for various failure scenarios. As long as we don't have specific errors, talking about this is irrelevant
- Game ID: For now, let's not add a gameId field
- Room Management: Players should be automatically matched into available rooms.
- Dummy Generation: For dummy cats, they should have a specific pattern (like "dummy_1", "dummy_2") playerId and catId values.
Concurrent Games: Multiple games can run simultaneously.
- Dummy Voting Timing: Dummies should vote immediately when voting phase starts, (maybe later on we can change this so dummies vote with some random delay to seem more natural, but stick to simplicity for now)
- Room Cleanup: There should not be any persistence of game results, everything is purely in-memory
- Important note: the server implementation will *not* have any data structure of all opened rooms! Each "handle new WS" function will hold a local variable referencing the room of the WS. The only global variable is the waitingRoom singleton - that starts with empty participants array, and is used by the first 5 "handle new WS" functions. Once it is full (e.g. in the 5th "handle new WS" function) - it will be re-created as an empty room.


## 7. Just ask 
Ask me if anything is unclear, if you have questions, or suggestions.



