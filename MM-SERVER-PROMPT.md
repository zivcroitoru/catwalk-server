# cat walk - a fashion show matchmaking system

## 1. User-story
1. The player registers/ signs up to our website
2. The player arrives to the main page- the cat album
	- The player has playerId (string), and playerCats (a list of owned cats)
	- Each cat has playerId, and CatId
	- For now, the userId and catId are the *only* information we need (later, we will add extra fields for them - but not now)
3. The player selects a cat from the album, and enters the fashion show
4. The player arrives at the "waiting room" (we enter the waiting-room phase). Note that the system has a *single* waiting room: it is cycled when it gets full (5 players). At any time - while waiting - the user can see the count of participants that are currently waiting in the room.
	-	A participant is Player + PlayerCat + votedCatId
5. If player wishes to quit the fashion show during the "waiting room" phase - the player will return to cat album, and will be removed from the room.
6. The player waits until the room is full with 5 participants (unless the player is the 5th one of course)
7. Once the waiting room has 5 participants, it enters the 'voting' phase, and is no longer "the waiting room". The waiting room is then recreated with no participants - and is ready to receive new participants.
8. A 60 seconds timer begins to run when entering the 'voting' phase.
8. The player sees all 5 playerCats
9. The player can click on a cat on the screen to vote for. The player can change the voted cat at any time (until all participants voted - and the room is "finalized").
	- The player's own cat will be shown on screen just like the others, but this cat will not be clickable for the player (the owner of the cat)
	- The players will always see how many participants already voted
	- The server will start a 60 seconds timer (at timeout - the server will make a random vote for every participant that didn't vote).
10. The voting phase will end once all 5/5 players have voted, or once the timer ran out
	- The player can either vote for a cat and wait for all the other players to vote as well, or wait until timer ends 
	- in the case that the player hasn't voted until the timeout, the player will get assigned an automatic and random vote to another cat
11. Once the voting phase ends, the room is "finalized": no further changes can be made. Players see the "rewards distribution" display
12. In the "rewards distribution" phase the players can see how many coins each one got rewarded with
	- How coin distribution works: The cat that has been voted for by N players, gets N * 25 coins.
13. The player can now choose if to "play again" (sends player waiting room, the cycle starts once again) or "go home" (sends player back to album)
14. If player wishes to quit the fashion show during the *voting phase* (or the connection drops) the player will be able to. If this happens, the other players will be "unaware" of this: The server will emulate as if the quitting participant made a random vote.

## 2. Messages
- client enters show: open WS (init msg: player + cat)
- server -> client: update waiting participants
- server -> client: enter voting phase
- server -> client: update voting state
- server -> client: final results (and close WS)
- client -> server: vote

## 3. TypeScript types and constants - common to server and client

```typescript

const PARTICIPANTS_IN_ROOM = 2;
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


## 4. Your Task
Look at the attached JS file: this is the code that I wrote for the client side - I don't yet know how well it will work, but it's a base.
Please write the server side in a JavaScript canvas to support the socket.io flow that I described, while writing only what's needed.

Additional notes:
- This project should be as simple as possible, we're not "looking for more work". 
- Voting timer updates: The server sends to the client the value of the timer, and the clients handle the countdown locally. We won't send periodic sync updates
- Error handling: As for now, we will not be adding error message types for various failure scenarios. As long as we don't have specific errors, talking about this is irrelevant
- Game ID / Room ID: For now, let's not add this at all. Note that if the WS is disconnected, the player will have no way of re-entering the room.
- Rooms Management: There should not be any persistence of game results, everything is purely in-memory and singleton
- Dummy Voting Timing: Dummies should vote immediately when voting phase starts, (maybe later on we can change this so dummies vote with some random delay to seem more natural, but stick to simplicity for now)
- Room Cleanup: There should not be any persistence of game results, everything is purely in-memory
- Important note: the server implementation will *not* have any data structure of all opened rooms! Each "handle new WS" function will hold a local variable referencing the room of the WS. The only global variable is the waitingRoom singleton - that starts with empty participants array, and is used by the first 5 "handle new WS" functions. Once it is full (e.g. in the 5th "handle new WS" function) - it will be re-created as an empty room.


