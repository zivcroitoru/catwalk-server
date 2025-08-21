import DB from "../db.js";


//-------------------- FASHION SHOW GAME LOGIC-------------------------//


// Configuration constants for game mechanics
const PARTICIPANTS_IN_ROOM = 5;
const VOTING_TIMER = 60; // seconds

// Global waiting room state - holds participants until room is full
let waitingRoom = {
  participants: [],
  isVoting: false,
};

// ------------------------------ Participant Creation with Database Integration---------------------------//

/**
 * Creates a participant object with complete database-fetched information
 * @param {number} playerId - The player's unique ID
 * @param {number} catId - The cat's unique ID  
 * @param {Object} socket - The socket.io connection object
 * @returns {Object} Complete participant object with fetched data
 */
async function createParticipant(playerId, catId, socket) {
  console.log(`Creating participant: player ${playerId}, cat ${catId}`);

  // Initialize participant with fallback values
  const participant = {
    playerId,
    catId,
    socket,
    isDummy: false,
    username: `Player_${playerId}`, // fallback if DB lookup fails
    catName: `Cat_${catId}`, // fallback if DB lookup fails
    catSpriteUrl: null,
    wornItems: [],
  };

  try {
    // Fetch player username from database
    const playerResult = await DB.query(
      "SELECT id, username FROM players WHERE id = $1",
      [playerId],
    );

    if (playerResult.rows.length > 0) {
      const playerRow = playerResult.rows[0];
      if (playerRow.username) {
        participant.username = playerRow.username;
        console.log(`Found username: ${participant.username}`);
      } else {
        console.log(`Player ${playerId} has null username, using fallback`);
      }
    } else {
      console.log(`No player found with id ${playerId}, using fallback`);
    }

    // Fetch cat data including template sprite
    const catResult = await DB.query(
      `
      SELECT 
        pc.cat_id, 
        pc.player_id, 
        pc.name, 
        pc.template,
        ct.sprite_url
      FROM player_cats pc
      LEFT JOIN cat_templates ct ON pc.template = ct.template
      WHERE pc.cat_id = $1 AND pc.player_id = $2
    `,
      [catId, playerId],
    );

    if (catResult.rows.length > 0) {
      const catRow = catResult.rows[0];
      if (catRow.name) {
        participant.catName = catRow.name;
        console.log(`Found cat name: ${participant.catName}`);
      } else {
        console.log(`Cat ${catId} has null name, using fallback`);
      }

      if (catRow.sprite_url) {
        participant.catSpriteUrl = catRow.sprite_url;
        console.log(`Found cat sprite URL`);
      } else {
        console.log(`No sprite URL found for cat ${catId}`);
      }
    } else {
      console.log(
        `No cat found with cat_id=${catId} and player_id=${playerId}`,
      );

      // Debug: Check what cats this player has
      const debugResult = await DB.query(
        "SELECT cat_id, player_id, name, template FROM player_cats WHERE player_id = $1",
        [playerId],
      );
      console.log(
        `Player ${playerId} has ${debugResult.rows.length} cats:`,
        debugResult.rows,
      );
    }

    // Fetch equipped items for this cat
    const itemsResult = await DB.query(
      `
      SELECT 
        ci.template,
        ci.category,
        it.sprite_url as item_sprite_url
      FROM cat_items ci
      LEFT JOIN itemtemplate it ON ci.template = it.template
      WHERE ci.cat_id = $1
    `,
      [catId],
    );

    if (itemsResult.rows.length > 0) {
      participant.wornItems = itemsResult.rows.map((item) => ({
        template: item.template,
        category: item.category,
        spriteUrl: item.item_sprite_url,
      }));
    }
  } catch (err) {
    console.error(`Failed to fetch data for participant (player: ${playerId}, cat: ${catId}):`, err.message);
    // Continue with fallback values
  }

  console.log(`Participant created successfully: ${participant.username} with ${participant.wornItems.length} items`);
  return participant;
}

// ---------------Game Room Class - Manages Active Fashion Show ---------------//

/**
 * Manages a single fashion show game session with 5 participants
 * Handles voting phase, results calculation, and coin distribution
 */
class GameRoom {
  constructor(participants) {
    this.participants = participants;
    this.isVoting = true;
    this.votingStartTime = Date.now();
    this.isFinalized = false;
    this.votingTimer = null;

    console.log(`Game room created with ${participants.length} participants`);
    this.startVotingPhase();
  }

  /**
   * Initiates the voting phase and sets up the countdown timer
   */
  startVotingPhase() {
    console.log(`Voting phase started with ${VOTING_TIMER}s timer`);

    // Notify all participants that voting has begun
    this.participants.forEach((participant) => {
      if (participant.socket?.connected) {
        participant.socket.emit("voting_phase", {
          type: "voting_phase",
          participants: this.getParticipantsForClient(),
          timerSeconds: VOTING_TIMER,
        });
      }
    });

    // Auto-vote for any dummy participants (disconnected players)
    this.participants.forEach((participant) => {
      if (participant.isDummy) {
        this.makeDummyVote(participant);
      }
    });

    // Set voting timeout - will auto-finalize if time runs out
    this.votingTimer = setTimeout(() => {
      console.log(`Voting timeout reached after ${VOTING_TIMER}s`);
      this.handleVotingTimeout();
    }, VOTING_TIMER * 1000);
  }

  /**
   * Generates a random vote for dummy participants (disconnected players)
   */
  makeDummyVote(dummy) {
    const availableCats = this.participants
      .filter((p) => p.catId !== dummy.catId)
      .map((p) => p.catId);

      if (availableCats.length > 0) {
      const choice = availableCats[Math.floor(Math.random() * availableCats.length)];
      this.handleVote(dummy, choice);
    }
  }

  /**
   * Updates player coin balance in database with comprehensive validation
   * @param {Object} participant - The participant receiving coins
   * @param {number} coinsToAdd - Amount of coins to add (must be multiple of 25)
   * @returns {Object} Update result with success status and details
   */
  async updatePlayerCoins(participant, coinsToAdd) {
    // Skip dummy participants (disconnected players)
    if (participant.isDummy) {
      return { success: true, skipped: true, reason: "dummy_participant" };
    }

    // Skip zero-coin updates to avoid unnecessary DB calls
    if (coinsToAdd === 0) {
      return { success: true, skipped: true, reason: "zero_coins" };
    }

    // Validate coin amount is valid integer multiple of 25
    if (!Number.isInteger(coinsToAdd)) {
      console.error(`Invalid coin amount for ${participant.username}: ${coinsToAdd} (not integer)`);
      return {
        success: false,
        error: "invalid_coin_amount_not_integer",
        playerId: participant.playerId,
        invalidAmount: coinsToAdd,
      };
    }

    if (coinsToAdd % 25 !== 0) {
      console.error(`Invalid coin amount for ${participant.username}: ${coinsToAdd} (not multiple of 25)`);
      return {
        success: false,
        error: "invalid_coin_amount_not_multiple_of_25",
        playerId: participant.playerId,
        invalidAmount: coinsToAdd,
      };
    }

    // Validate coin amount is within expected range (0-100 for fashion show)
    if (coinsToAdd < 0 || coinsToAdd > 100) {
      console.error(`Coin amount out of range for ${participant.username}: ${coinsToAdd}`);
      return {
        success: false,
        error: "invalid_coin_amount_out_of_range",
        playerId: participant.playerId,
        invalidAmount: coinsToAdd,
      };
    }

    try {
      // Get current balance for validation
      const currentResult = await DB.query(
        "SELECT coins FROM players WHERE id = $1",
        [participant.playerId],
      );

      if (currentResult.rows.length === 0) {
        console.error(`Player ${participant.playerId} not found in database`);
        return {
          success: false,
          error: "player_not_found",
          playerId: participant.playerId,
        };
      }

      const currentCoins = currentResult.rows[0].coins;
      const expectedTotal = currentCoins + coinsToAdd;

      // Execute the coin update
      const result = await DB.query(
        "UPDATE players SET coins = coins + $1 WHERE id = $2 RETURNING id, coins",
        [coinsToAdd, participant.playerId],
      );

      const actualTotal = result.rows[0].coins;

      // Verify the update was correct
      if (actualTotal !== expectedTotal) {
        console.error(`Database inconsistency for ${participant.username}: expected ${expectedTotal}, got ${actualTotal}`);
        return {
          success: false,
          error: "database_inconsistency",
          playerId: participant.playerId,
          expected: expectedTotal,
          actual: actualTotal,
          difference: actualTotal - expectedTotal,
        };
      }

      console.log(`Coins updated: ${participant.username} +${coinsToAdd} (${currentCoins} → ${actualTotal})`);

      return {
        success: true,
        skipped: false,
        playerId: participant.playerId,
        username: participant.username,
        coinsAdded: coinsToAdd,
        previousTotal: currentCoins,
        newTotal: actualTotal,
      };
    } catch (error) {
      console.error(`Database error updating coins for ${participant.playerId}:`, error.message);
      return {
        success: false,
        error: "database_error",
        playerId: participant.playerId,
        details: error.message,
      };
    }
  }

  /**
   * Processes a vote from a participant with comprehensive validation
   * @param {Object} voter - The participant casting the vote
   * @param {number} votedCatId - The cat ID being voted for
   */
  handleVote(voter, votedCatId) {
    // Prevent votes after game is finalized
    if (this.isFinalized) {
      console.warn(`Vote rejected from ${voter.playerId}: game already finalized`);
      return;
    }

    // Validate voter is actually in this game room
    const voterInRoom = this.participants.find(
      (p) => p.playerId === voter.playerId && p.catId === voter.catId,
    );

    if (!voterInRoom) {
      console.warn(`Vote rejected: ${voter.playerId} not found in game room`);
      return;
    }

    // Normalize and validate cat IDs
    const normalizedVotedCatId = parseInt(votedCatId);
    const normalizedVoterCatId = parseInt(voter.catId);

    if (isNaN(normalizedVotedCatId) || isNaN(normalizedVoterCatId)) {
      console.warn(`Vote rejected: invalid catId format (voter: ${voter.catId}, voted: ${votedCatId})`);
      return;
    }

    // Find the target participant being voted for
    const targetParticipant = this.participants.find((p) => {
      const participantCatId = parseInt(p.catId);
      return participantCatId === normalizedVotedCatId;
    });

    if (!targetParticipant) {
      console.warn(`Vote rejected: cat ${normalizedVotedCatId} not found in game room`);
      return;
    }

    // Prevent self-voting
    if (normalizedVotedCatId === normalizedVoterCatId) {
      console.warn(`Vote rejected: ${voter.playerId} attempted self-vote`);
      return;
    }

    // Record the vote (allow vote changes)
    const previousVote = voterInRoom.votedCatId;
    voterInRoom.votedCatId = normalizedVotedCatId;

    if (previousVote) {
      console.log(`Vote changed: ${voterInRoom.username} from ${previousVote} to ${normalizedVotedCatId}`);
    } else {
      console.log(`Vote cast: ${voterInRoom.username} → ${targetParticipant.catName} (${normalizedVotedCatId})`);
    }

    // Update all clients with current voting state
    this.broadcastVotingUpdate();

    // Check if all participants have voted (early game end)
    const allVoted = this.participants.every(
      (p) => p.votedCatId !== null && p.votedCatId !== undefined,
    );
    
    const votedCount = this.participants.filter(
      (p) => p.votedCatId !== null && p.votedCatId !== undefined,
    ).length;

    if (allVoted) {
      console.log(`All ${this.participants.length} participants voted - ending early`);
      
      // Cancel the voting timer since we're ending early
      if (this.votingTimer) {
        clearTimeout(this.votingTimer);
        this.votingTimer = null;
      }

      // Small delay for better UX before showing results
      setTimeout(() => {
        this.finalizeVoting();
      }, 1500);
    } else {
      console.log(`Voting progress: ${votedCount}/${this.participants.length} participants`);
    }
  }

  /**
   * Handles voting timeout by assigning random votes to non-voters
   */
  handleVotingTimeout() {
    if (this.isFinalized) return;

    const votingDuration = ((Date.now() - this.votingStartTime) / 1000).toFixed(1);
    console.log(`Voting timeout after ${votingDuration}s - assigning random votes`);

    // Assign random votes to participants who haven't voted
    let autoVotesAssigned = 0;
    this.participants.forEach((participant) => {
      const hasVoted = participant.votedCatId !== null && 
                     participant.votedCatId !== undefined && 
                     !isNaN(participant.votedCatId);

      if (!hasVoted) {
        // Get available cats (excluding self)
        const availableCats = this.participants
          .filter((p) => parseInt(p.catId) !== parseInt(participant.catId))
          .map((p) => parseInt(p.catId));

        if (availableCats.length > 0) {
          const choice = availableCats[Math.floor(Math.random() * availableCats.length)];
          participant.votedCatId = choice;
          autoVotesAssigned++;

          const votedForParticipant = this.participants.find(
            (p) => parseInt(p.catId) === choice,
          );
          console.log(`Auto-vote assigned: ${participant.username} → ${votedForParticipant?.catName}`);
        }
      }
    });

    console.log(`Assigned ${autoVotesAssigned} automatic votes due to timeout`);
    this.finalizeVoting();
  }

  /**
   * Finalizes voting and initiates results calculation and display
   */
  async finalizeVoting() {
    if (this.isFinalized) return;
    this.isFinalized = true;

    const votingDuration = ((Date.now() - this.votingStartTime) / 1000).toFixed(1);
    console.log(`Finalizing voting after ${votingDuration}s`);

    // Clear any remaining timer
    if (this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
    }

    // Calculate results (vote counting and coin calculations)
    this.calculateResults();

    // Show "calculating votes" message to all participants
    this.participants.forEach((participant) => {
      if (participant.socket?.connected) {
        participant.socket.emit("calculating_announcement", {
          type: "calculating_announcement",
          message: "CALCULATING VOTES, PLEASE WAIT . . .",
        });
      }
    });

    // Delay before applying database updates - allows disconnects to be processed
    setTimeout(async () => {
      console.log("Applying coin rewards to database");

      try {
        // Update database with coin rewards
        const dbUpdateSummary = await this.updateDatabaseWithRewards();

        // Send final results to all participants
        let resultsMessagesSent = 0;
        let resultsMessagesFailed = 0;

        this.participants.forEach((participant) => {
          if (participant.socket?.connected) {
            try {
              // Ensure toast data exists with required fields
              const toastData = participant.toastData || {
                success: false,
                error: "No toast data generated",
                coinsEarned: 0,
                votesReceived: participant.votesReceived || 0,
              };

              // Validate required toast data fields
              if (!toastData.hasOwnProperty("success")) {
                toastData.success = false;
                toastData.error = "incomplete_toast_data";
              }
              if (!toastData.hasOwnProperty("coinsEarned")) {
                toastData.coinsEarned = 0;
              }
              if (!toastData.hasOwnProperty("votesReceived")) {
                toastData.votesReceived = participant.votesReceived || 0;
              }

              const resultsMessage = {
                type: "results",
                participants: this.getParticipantsForClient(),
                toastData: toastData,
              };

              participant.socket.emit("results", resultsMessage);
              resultsMessagesSent++;

            } catch (err) {
              console.error(`Failed to send results to ${participant.username}:`, err);
              resultsMessagesFailed++;
            }
          } else {
            resultsMessagesFailed++;
          }
        });

        console.log(`Results sent to ${resultsMessagesSent}/${this.participants.length} participants`);
        console.log("Game completed successfully");
        
      } catch (error) {
        console.error("Critical error during database updates:", error);

        // Send error results if database updates fail
        this.participants.forEach((participant) => {
          if (participant.socket?.connected) {
            const errorToastData = {
              success: false,
              error: "database_update_failed",
              coinsEarned: 0,
              votesReceived: participant.votesReceived || 0,
              details: "Server error during coin processing",
            };

            participant.socket.emit("results", {
              type: "results",
              participants: this.getParticipantsForClient(),
              toastData: errorToastData,
            });
          }
        });
      }
    }, 3000); // 3 second delay for disconnect processing
  }

  /**
   * Calculates vote results and coin rewards (no database updates)
   */
  async calculateResults() {
    console.log("Calculating vote results and coin rewards");

    // Validate participant data integrity
    this.participants.forEach((p, idx) => {
      const catId = parseInt(p.catId);
      if (isNaN(catId) || catId <= 0) {
        console.error(`Invalid catId for participant ${idx}: ${p.catId}`);
      }
    });

    // Count votes with explicit validation
    const votes = {};
    this.participants.forEach((voter) => {
      if (voter.votedCatId !== null && 
          voter.votedCatId !== undefined && 
          !isNaN(voter.votedCatId)) {
        
        const votedCatId = parseInt(voter.votedCatId);
        const voteKey = votedCatId.toString();

        // Validate vote target exists
        const targetParticipant = this.participants.find(
          (p) => parseInt(p.catId) === votedCatId,
        );

        if (!targetParticipant) {
          console.error(`Invalid vote: ${voter.username} voted for non-existent cat ${votedCatId}`);
          return; // Skip this vote
        }

        votes[voteKey] = (votes[voteKey] || 0) + 1;
      }
    });

    // Calculate rewards based on votes received
    let totalCoinsDistributed = 0;
    this.participants.forEach((p) => {
      const catId = parseInt(p.catId);
      const catIdKey = catId.toString();

      if (isNaN(catId)) {
        console.error(`Cannot calculate rewards for participant with invalid catId: ${p.catId}`);
        p.votesReceived = 0;
        p.coinsEarned = 0;
        return;
      }

      p.votesReceived = votes[catIdKey] || 0;
      p.coinsEarned = p.votesReceived * 25; // 25 coins per vote
      totalCoinsDistributed += p.coinsEarned;

      // Validate calculation
      if (!Number.isInteger(p.coinsEarned) || p.coinsEarned % 25 !== 0) {
        console.error(`Invalid coin calculation for ${p.username}: ${p.coinsEarned} coins`);
      }
    });

    // Log final results summary
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    console.log(`Results calculated: ${totalVotes} votes cast, ${totalCoinsDistributed} coins to distribute`);

    if (totalCoinsDistributed % 25 !== 0) {
      console.error(`Total coins ${totalCoinsDistributed} is not multiple of 25 - calculation error!`);
    }
  }

  /**
   * Applies calculated coin rewards to database during results display phase
   */
  async updateDatabaseWithRewards() {
    console.log("Applying coin rewards to database");

    const dbUpdateResults = [];
    let successfulUpdates = 0;
    let failedUpdates = 0;
    let skippedUpdates = 0;

    // Process each participant's coin update
    for (const participant of this.participants) {
      try {
        // Skip dummy participants (disconnected players)
        if (participant.isDummy) {
          participant.toastData = {
            success: true,
            skipped: true,
            reason: "dummy_participant_disconnected",
            coinsEarned: 0,
            votesReceived: participant.votesReceived || 0,
          };
          
          skippedUpdates++;
          dbUpdateResults.push({
            playerId: participant.playerId,
            username: participant.username,
            coinsEarned: 0,
            votesReceived: participant.votesReceived || 0,
            updateResult: { success: true, skipped: true, reason: "dummy_participant_disconnected" }
          });
          
          continue;
        }

        // Validate participant data before database update
        if (!participant.playerId || !Number.isInteger(participant.coinsEarned)) {
          console.error(`Invalid participant data: ${participant.username}`);
          participant.toastData = {
            success: false,
            error: "invalid_participant_data",
            coinsEarned: 0,
            votesReceived: participant.votesReceived || 0,
          };
          failedUpdates++;
          continue;
        }

        // Update player coins in database
        const updateResult = await this.updatePlayerCoins(
          participant,
          participant.coinsEarned,
        );

        dbUpdateResults.push({
          playerId: participant.playerId,
          username: participant.username,
          coinsEarned: participant.coinsEarned,
          votesReceived: participant.votesReceived || 0,
          updateResult,
        });

        // Store appropriate toast data based on update result
        if (updateResult.success) {
          if (updateResult.skipped) {
            skippedUpdates++;
            participant.toastData = {
              success: true,
              skipped: true,
              reason: updateResult.reason,
              coinsEarned: participant.coinsEarned,
              votesReceived: participant.votesReceived || 0,
            };
          } else {
            successfulUpdates++;
            participant.toastData = {
              success: true,
              skipped: false,
              coinsEarned: participant.coinsEarned,
              votesReceived: participant.votesReceived || 0,
              newTotal: updateResult.newTotal,
              previousTotal: updateResult.previousTotal,
            };
          }
        } else {
          failedUpdates++;
          participant.toastData = {
            success: false,
            error: updateResult.error || "unknown_error",
            coinsEarned: 0,
            votesReceived: participant.votesReceived || 0,
            details: updateResult.details || "No additional details",
          };

          // Enhanced logging for validation failures
          if (updateResult.error && updateResult.error.includes("invalid_coin_amount")) {
            console.error(`Coin validation failure: ${participant.username} attempted ${updateResult.invalidAmount} coins`);
            console.error(`Vote calculation: ${participant.votesReceived} votes × 25 = ${participant.coinsEarned} coins`);
          }
        }
      } catch (error) {
        console.error(`Unexpected error updating ${participant.username}:`, error);
        failedUpdates++;
        participant.toastData = {
          success: false,
          error: "unexpected_database_error",
          coinsEarned: 0,
          votesReceived: participant.votesReceived || 0,
          details: error.message,
        };
      }
    }

    console.log(`Database updates complete: ${successfulUpdates} successful, ${skippedUpdates} skipped, ${failedUpdates} failed`);

    if (failedUpdates > 0) {
      console.warn(`Warning: ${failedUpdates} database updates failed - some players may not have received coins`);
    }

    return { successfulUpdates, failedUpdates, skippedUpdates, dbUpdateResults };
  }

  /**
   * Broadcasts current voting state to all participants
   */
  broadcastVotingUpdate() {
    this.participants.forEach((p) => {
      if (p.socket?.connected) {
        p.socket.emit("voting_update", {
          type: "voting_update",
          participants: this.getParticipantsForClient(),
        });
      }
    });
  }

  /**
   * Formats participant data for client consumption
   * @returns {Array} Sanitized participant data for frontend
   */
  getParticipantsForClient() {
    return this.participants.map((p) => {
      // Ensure all required fields are present and valid
      const participantData = {
        playerId: p.playerId,
        catId: p.catId,
        username: p.username || `Player_${p.playerId}`,
        catName: p.catName || `Cat_${p.catId}`,
        catSpriteUrl: p.catSpriteUrl || null,
        wornItems: Array.isArray(p.wornItems) ? p.wornItems : [],
        votedCatId: p.votedCatId || null,
        votesReceived: Number.isInteger(p.votesReceived) ? p.votesReceived : 0,
        coinsEarned: Number.isInteger(p.coinsEarned) ? p.coinsEarned : 0,
      };

      // Validate vote/coin consistency
      if (p.votesReceived && p.coinsEarned !== p.votesReceived * 25) {
        console.error(`Data inconsistency: ${p.username} has ${p.votesReceived} votes but ${p.coinsEarned} coins`);
      }

      return participantData;
    });
  }

  /**
   * Handles participant disconnect during active game
   * @param {Object} p - The disconnecting participant
   */
  handleParticipantDisconnect(p) {
    // Don't process disconnects after game is finalized
    if (this.isFinalized) {
      console.log(`Disconnect noted for ${p.username} but game already finalized`);
      return;
    }

    // Mark participant as dummy to prevent coin rewards
    console.log(`Marking disconnected participant ${p.username} as dummy (no rewards)`);
    p.isDummy = true;

    // Assign random vote if they haven't voted and voting is still active
    if (!p.votedCatId && this.isVoting) {
      const options = this.participants
        .filter((x) => x.catId !== p.catId)
        .map((x) => x.catId);
      
      if (options.length > 0) {
        const vote = options[Math.floor(Math.random() * options.length)];
        p.votedCatId = vote;
        console.log(`Auto-vote assigned for disconnected player: ${p.username} → cat ${vote}`);

        // Check if all participants have now voted
        const allVoted = this.participants.every((participant) => participant.votedCatId);
        if (allVoted) {
          console.log("All participants voted after disconnect - finalizing game");
          this.finalizeVoting();
        } else {
          this.broadcastVotingUpdate();
        }
      }
    }
  }
}

//---------------Broadcast Waiting Room Management---------------//

/**
 * Broadcasts current waiting room state to all waiting participants
 */
function broadcastWaitingRoomUpdate() {
  const participantsForClient = waitingRoom.participants.map((p) => ({
    playerId: p.playerId,
    catId: p.catId,
    username: p.username,
    catName: p.catName,
    catSpriteUrl: p.catSpriteUrl,
    wornItems: p.wornItems,
  }));

  waitingRoom.participants.forEach((p) => {
    if (p.socket?.connected) {
      p.socket.emit("participant_update", {
        type: "participant_update",
        participants: participantsForClient,
        maxCount: PARTICIPANTS_IN_ROOM,
      });
    }
  });
  
  console.log(`Waiting room update sent to ${waitingRoom.participants.length} participants`);
}

//---------------MAIN SOCKET SETUP FUNCTION---------------//

/**
 * Sets up all socket.io event handlers for both fashion show and ticket system
 * @param {Object} io - The socket.io server instance
 */
export default function setupSocket(io) {
  // Connection tracking for both fashion show and ticket system
  const playerSockets = new Map(); // playerId -> socketId mapping
  const adminSockets = new Set();  // Set of admin socket IDs

  io.on("connection", (socket) => {
    console.log(`New connection established: ${socket.id}`);

    // Local state for this specific socket connection
    let currentParticipant = null;  // Fashion show participant data
    let currentGameRoom = null;     // Active game room reference


    // ---------------FASHION SHOW EVENT HANDLERS---------------//


    /**
     * Handles player joining the fashion show waiting room
     */
    socket.on("join", async (message) => {
      console.log(`Join request received from ${socket.id}:`, { playerId: message?.playerId, catId: message?.catId });

      // Validate join message structure
      if (!message || typeof message !== "object") {
        console.warn(`Invalid join message format from ${socket.id}`);
        socket.emit("error", {
          message: "Invalid join request format",
          type: "validation_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      if (!message.playerId || !message.catId) {
        console.warn(`Missing required fields from ${socket.id}: playerId=${message.playerId}, catId=${message.catId}`);
        socket.emit("error", {
          message: "Invalid join request - missing player or cat data",
          type: "validation_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      // Parse and validate ID formats
      const playerId = parseInt(message.playerId);
      const catId = parseInt(message.catId);

      if (isNaN(playerId) || isNaN(catId) || playerId <= 0 || catId <= 0) {
        console.warn(`Invalid ID format from ${socket.id}: playerId=${message.playerId}, catId=${message.catId}`);
        socket.emit("error", {
          message: "Invalid player or cat ID format",
          type: "validation_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      try {
        // Verify cat ownership before allowing join
        const catValidation = await DB.query(
          "SELECT cat_id FROM player_cats WHERE cat_id = $1 AND player_id = $2",
          [catId, playerId],
        );

        if (catValidation.rows.length === 0) {
          console.warn(`Ownership violation: Player ${playerId} does not own cat ${catId}`);
          socket.emit("error", {
            message: "You do not own the selected cat",
            type: "ownership_error",
            severity: "error",
          });
          return socket.disconnect();
        }
      } catch (err) {
        console.error(`Database error during cat validation for ${socket.id}:`, err);
        socket.emit("error", {
          message: "Database connection error - please try again",
          type: "database_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      // Check for duplicate participants in waiting room
      const existingParticipant = waitingRoom.participants.find(
        (p) => p.playerId === playerId || (p.playerId === playerId && p.catId === catId),
      );

      if (existingParticipant) {
        console.warn(`Duplicate join attempt: Player ${playerId} already in waiting room`);
        socket.emit("error", {
          message: "You are already in the waiting room",
          type: "duplicate_join",
          severity: "warning",
        });
        return socket.disconnect();
      }

      try {
        // Create participant with full database lookup
        socket.participant = await createParticipant(playerId, catId, socket);
        currentParticipant = socket.participant;

        if (!socket.participant) {
          throw new Error("Participant creation returned null");
        }

        if (!socket.participant.catSpriteUrl) {
          console.warn(`Missing sprite URL for cat ${catId} - client may show placeholder`);
        }

        console.log(`Participant created successfully: ${socket.participant.username} with cat ${socket.participant.catName}`);
      } catch (err) {
        console.error(`Failed to create participant for ${socket.id}:`, err);
        socket.emit("error", {
          message: "Failed to load your cat data - please try again",
          type: "data_loading_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      // Add to waiting room if space available and not currently voting
      if (waitingRoom.participants.length < PARTICIPANTS_IN_ROOM && !waitingRoom.isVoting) {
        waitingRoom.participants.push(socket.participant);
        console.log(`Added to waiting room: ${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM} participants`);

        broadcastWaitingRoomUpdate();

        // Launch game when room is full
        if (waitingRoom.participants.length === PARTICIPANTS_IN_ROOM) {
          console.log("Waiting room full - launching game");

          // Final validation to prevent duplicate participants
          const uniqueParticipants = waitingRoom.participants.filter(
            (p, index, arr) =>
              arr.findIndex(other => other.playerId === p.playerId && other.catId === p.catId) === index,
          );

          if (uniqueParticipants.length !== PARTICIPANTS_IN_ROOM) {
            console.error(`Duplicate participants detected! Expected ${PARTICIPANTS_IN_ROOM}, got ${uniqueParticipants.length} unique`);
            // Reset waiting room and disconnect all participants
            waitingRoom.participants.forEach((p) => {
              if (p.socket?.connected) {
                p.socket.emit("error", {
                  message: "Room setup error - please try joining again",
                  type: "room_error",
                  severity: "error",
                });
                p.socket.disconnect();
              }
            });
            waitingRoom = { participants: [], isVoting: false };
            return;
          }

          // Create game room and assign to participant sockets
          const gameRoom = new GameRoom([...uniqueParticipants]);
          uniqueParticipants.forEach((p) => {
            if (!p.isDummy && p.socket) {
              p.socket.currentGameRoom = gameRoom;
            }
          });

          // Reset waiting room for next game
          waitingRoom = { participants: [], isVoting: false };
        }
      } else {
        console.warn(`Cannot join: room full (${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM}) or voting in progress`);
        socket.emit("error", {
          message: "Fashion show room is full - please try again later",
          type: "room_full",
          severity: "info",
        });
        socket.disconnect();
      }
    });

    /**
     * Handles vote submission from participants
     */
    socket.on("vote", (message) => {
      // Validate vote context
      if (!currentParticipant) {
        console.warn(`Vote rejected from ${socket.id}: no participant context`);
        socket.emit("error", {
          message: "Invalid voting state - please refresh",
          type: "vote_error",
          severity: "warning",
        });
        return;
      }

      if (!socket.currentGameRoom) {
        console.warn(`Vote rejected from ${socket.id}: no game room assigned`);
        socket.emit("error", {
          message: "Not connected to game room - please refresh",
          type: "vote_error",
          severity: "warning",
        });
        return;
      }

      if (!(socket.currentGameRoom instanceof GameRoom)) {
        console.warn(`Vote rejected from ${socket.id}: invalid game room instance`);
        socket.emit("error", {
          message: "Invalid game room state - please refresh",
          type: "vote_error",
          severity: "error",
        });
        return;
      }

      if (socket.currentGameRoom.isFinalized) {
        console.warn(`Vote rejected from ${socket.id}: game already finalized`);
        socket.emit("error", {
          message: "Voting has already ended",
          type: "vote_too_late",
          severity: "info",
        });
        return;
      }

      console.log(`Processing vote: ${currentParticipant.username} → cat ${message.votedCatId}`);

      // Send vote confirmation to client
      socket.emit("vote_confirmed", {
        type: "vote_confirmed",
        votedCatId: message.votedCatId,
        voterName: currentParticipant.username,
      });

      // Process the vote through game room
      socket.currentGameRoom.handleVote(currentParticipant, message.votedCatId);
    });

    /**
     * Connection health monitoring via heartbeat system
     */
    const heartbeatInterval = setInterval(() => {
      if (currentParticipant && socket.connected) {
        socket.emit("heartbeat", { timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds

    socket.on("heartbeat_response", (data) => {
      if (currentParticipant) {
        currentParticipant.lastSeen = Date.now();
      }
    });


    //----------------TICKET SYSTEM EVENT HANDLERS (Legacy Support)---------------//


    /**
     * Admin broadcast message to all players
     */
    socket.on("adminBroadcast", async ({ message }) => {
      try {
        const insertResult = await DB.query(
          `INSERT INTO broadcasts(body, sent_at) VALUES ($1, NOW()) RETURNING *`,
          [message],
        );
        const broadcast = insertResult.rows[0];

        // Send broadcast to all registered players
        const playersResult = await DB.query("SELECT id FROM players");
        playersResult.rows.forEach((row) => {
          io.to(`user_${row.id}`).emit("adminBroadcast", {
            message: broadcast.body,
            date: broadcast.sent_at,
          });
        });
        
        console.log(`Admin broadcast sent to ${playersResult.rows.length} players`);
      } catch (err) {
        console.error("Error sending admin broadcast:", err);
      }
    });

    /**
     * Admin registration for ticket system
     */
    socket.on("registerAdmin", () => {
      adminSockets.add(socket.id);
      socket.join("admins");
      console.log(`Admin registered: ${socket.id}`);
    });

    /**
     * Player registration for ticket system
     */
    socket.on("registerPlayer", async (userId) => {
      socket.join(`user_${userId}`);
      playerSockets.set(userId, socket.id);
      console.log(`Player registered: ${userId} (${socket.id})`);

      try {
        // Auto-join all open ticket rooms for this player
        const result = await DB.query(
          `SELECT ticket_id FROM tickets_table WHERE user_id = $1 AND status = 'open'`,
          [userId],
        );
        result.rows.forEach((row) => {
          const ticketRoom = `ticket_${row.ticket_id}`;
          socket.join(ticketRoom);
        });
        
        if (result.rows.length > 0) {
          console.log(`Player ${userId} joined ${result.rows.length} ticket rooms`);
        }
      } catch (err) {
        console.error(`Failed to load ticket rooms for player ${userId}:`, err);
      }
    });

    /**
     * Admin joins specific ticket room
     */
    socket.on("joinTicketRoom", ({ ticketId }) => {
      const roomName = `ticket_${ticketId}`;
      socket.join(roomName);
      console.log(`Admin joined ticket room: ${roomName}`);
    });

    /**
     * Player sends message in ticket
     */
    socket.on("playerMessage", async ({ ticketId, userId, text }) => {
      const roomName = `ticket_${ticketId}`;

      try {
        await DB.query(
          `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'user', $2, NOW())`,
          [ticketId, text],
        );

        io.to(roomName).emit("newMessage", {
          sender: "user",
          content: text,
          ticketId,
          userId,
        });
        
        console.log(`Player message sent in ticket ${ticketId}`);
      } catch (err) {
        console.error(`Error saving player message for ticket ${ticketId}:`, err);
      }
    });

    /**
     * Player opens or retrieves existing ticket
     */
    socket.on("openTicketRequest", async ({ userId }, callback) => {
      try {
        // Check for existing open ticket
        const result = await DB.query(
          `SELECT * FROM tickets_table WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
          [userId],
        );

        if (result.rows.length > 0) {
          console.log(`Returning existing ticket for player ${userId}`);
          callback({ ticket: result.rows[0] });
        } else {
          // Create new ticket
          const insertResult = await DB.query(
            `INSERT INTO tickets_table (user_id, status) VALUES ($1, 'open') RETURNING *`,
            [userId],
          );

          const newTicket = insertResult.rows[0];
          console.log(`New ticket created for player ${userId}: ticket ${newTicket.ticket_id}`);

          // Notify all admins of new ticket
          io.to("admins").emit("newTicketCreated", newTicket);
          callback({ ticket: newTicket });
        }
      } catch (err) {
        console.error(`Error in openTicketRequest for player ${userId}:`, err);
        callback({ error: "Failed to open or create ticket" });
      }
    });

    /**
     * Admin sends message in ticket
     */
    socket.on("adminMessage", async ({ ticketId, text }) => {
      const roomName = `ticket_${ticketId}`;

      try {
        await DB.query(
          `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'admin', $2, NOW())`,
          [ticketId, text],
        );

        io.to(roomName).emit("newMessage", {
          sender: "admin",
          content: text,
          ticketId,
        });
        
        console.log(`Admin message sent in ticket ${ticketId}`);
      } catch (err) {
        console.error(`Error saving admin message for ticket ${ticketId}:`, err);
      }
    });

    /**
     * Admin closes ticket
     */
    socket.on("closeTicket", async ({ ticketId }) => {
      try {
        await DB.query(
          `UPDATE tickets_table SET status = 'closed' WHERE ticket_id = $1`,
          [ticketId],
        );

        // Notify all participants in ticket room
        io.to(`ticket_${ticketId}`).emit("ticketClosed", { ticketId });
        console.log(`Ticket ${ticketId} closed by admin`);
      } catch (err) {
        console.error(`Error closing ticket ${ticketId}:`, err);
        socket.emit("errorMessage", { message: "Failed to close ticket." });
      }
    });

    //--------------DISCONNECT HANDLER---------------//

    socket.on("disconnect", () => {
      console.log(`Connection terminated: ${socket.id}`);

      // Clean up heartbeat monitoring
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // Handle fashion show participant disconnect
      if (currentParticipant) {
        console.log(`Processing fashion show disconnect for ${currentParticipant.username} (${currentParticipant.playerId})`);

        // Check if participant is in waiting room
        const waitingRoomIdx = waitingRoom.participants.findIndex(
          (p) => p.playerId === currentParticipant.playerId && p.catId === currentParticipant.catId,
        );

        if (waitingRoomIdx > -1) {
          waitingRoom.participants.splice(waitingRoomIdx, 1);
          broadcastWaitingRoomUpdate();
          console.log(`Removed ${currentParticipant.username} from waiting room`);
        } else {
          // Handle disconnect during active game
          let foundInGameRoom = false;
          
          if (socket.currentGameRoom instanceof GameRoom) {
            // Find participant in game room and mark as dummy
            const gameRoomParticipant = socket.currentGameRoom.participants.find(p => 
              p.playerId === currentParticipant.playerId && p.catId === currentParticipant.catId
            );
            
            if (gameRoomParticipant) {
              console.log(`Marking ${gameRoomParticipant.username} as dummy due to disconnect`);
              gameRoomParticipant.isDummy = true;
              socket.currentGameRoom.handleParticipantDisconnect(gameRoomParticipant);
              foundInGameRoom = true;
            }
          }
          
          if (!foundInGameRoom) {
            console.error(`Could not locate ${currentParticipant.username} in any active game room`);
          }
        }
      }

      // Clean up ticket system connections
      adminSockets.delete(socket.id);
      for (const [userId, socketId] of playerSockets.entries()) {
        if (socketId === socket.id) {
          playerSockets.delete(userId);
          console.log(`Removed player ${userId} socket mapping`);
          break;
        }
      }
    });
  });
  
  console.log("Socket.IO server initialized with fashion show and ticket system handlers");
}