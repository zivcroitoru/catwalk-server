import DB from "../db.js";

// ═══════════════════════════════════════════════════════════════
// FASHION SHOW LOGIC (NEW)
// ═══════════════════════════════════════════════════════════════

// Fashion Show Constants
const PARTICIPANTS_IN_ROOM = 5;
const VOTING_TIMER = 60;

// Global waiting room
let waitingRoom = {
  participants: [],
  isVoting: false,
};

// ─────────────── Enhanced participant creation with database queries ───────────────
async function createParticipant(playerId, catId, socket) {
  console.log(`🔍 Fetching complete data for player ${playerId}, cat ${catId}`);

  const participant = {
    playerId,
    catId,
    socket,
    isDummy: false,
    username: `Player_${playerId}`, // fallback
    catName: `Cat_${catId}`, // fallback
    catSpriteUrl: null,
    wornItems: [],
  };

  try {
    // Fetch player data
    const playerResult = await DB.query(
      "SELECT id, username FROM players WHERE id = $1",
      [playerId],
    );

    if (playerResult.rows.length > 0) {
      const playerRow = playerResult.rows[0];
      if (playerRow.username) {
        participant.username = playerRow.username;
        console.log(`✅ Found username: ${participant.username}`);
      } else {
        console.log(`⚠️ Player ${playerId} has null username, using fallback`);
      }
    } else {
      console.log(`⚠️ No player found with id ${playerId}, using fallback`);
    }

    // Fetch cat data with sprite URL
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
        console.log(`✅ Found cat name: ${participant.catName}`);
      } else {
        console.log(`⚠️ Cat ${catId} has null name, using fallback`);
      }

      if (catRow.sprite_url) {
        participant.catSpriteUrl = catRow.sprite_url;
        console.log(`✅ Found cat sprite URL`);
      } else {
        console.log(`⚠️ No sprite URL found for cat ${catId}`);
      }
    } else {
      console.log(
        `⚠️ No cat found with cat_id=${catId} and player_id=${playerId}`,
      );

      // Debug: Check what cats this player has
      const debugResult = await DB.query(
        "SELECT cat_id, player_id, name, template FROM player_cats WHERE player_id = $1",
        [playerId],
      );
      console.log(
        `🔍 Player ${playerId} has ${debugResult.rows.length} cats:`,
        debugResult.rows,
      );
    }

    // Fetch worn items
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
      console.log(`✅ Found ${participant.wornItems.length} worn items`);
    }
  } catch (err) {
    console.error(
      `❌ Failed to fetch data for player ${playerId}, cat ${catId}:`,
      err.message,
    );
    // Keep using fallback values
  }

  console.log(`✅ Participant created:`, {
    playerId: participant.playerId,
    catId: participant.catId,
    username: participant.username,
    catName: participant.catName,
    hasSprite: !!participant.catSpriteUrl,
    wornItemsCount: participant.wornItems.length,
  });

  return participant;
}

// ─────────────── Game Room Class ───────────────
class GameRoom {
  constructor(participants) {
    this.participants = participants;
    this.isVoting = true;
    this.votingStartTime = Date.now();
    this.isFinalized = false;
    this.votingTimer = null;

    console.log(
      "🗳️ GameRoom created with participants:",
      this.participants.map((p) => p.playerId),
    );
    this.startVotingPhase();
  }

  startVotingPhase() {
    console.log("⏳ Voting phase started");

    // Send voting phase message to all participants
    this.participants.forEach((participant) => {
      if (participant.socket?.connected) {
        participant.socket.emit("voting_phase", {
          type: "voting_phase",
          participants: this.getParticipantsForClient(),
          timerSeconds: VOTING_TIMER,
        });
        console.log(`📤 Sent voting_phase to ${participant.playerId}`);
      }
    });

    // Make dummy votes immediately
    this.participants.forEach((participant) => {
      if (participant.isDummy) {
        this.makeDummyVote(participant);
      }
    });

    // Set voting timeout
    this.votingTimer = setTimeout(() => {
      console.log("⏰ Voting timeout reached");
      this.handleVotingTimeout();
    }, VOTING_TIMER * 1000);
  }

  makeDummyVote(dummy) {
    const availableCats = this.participants
      .filter((p) => p.catId !== dummy.catId)
      .map((p) => p.catId);
    if (availableCats.length > 0) {
      const choice =
        availableCats[Math.floor(Math.random() * availableCats.length)];
      console.log(`🤖 Dummy ${dummy.playerId} voting for ${choice}`);
      this.handleVote(dummy, choice);
    }
  }

  // 🔧 ENHANCED: updatePlayerCoins with additional validation and logging
  async updatePlayerCoins(participant, coinsToAdd) {
    if (participant.isDummy) {
      console.log(
        `🤖 Skipping coin update for dummy participant ${participant.playerId}`,
      );
      return { success: true, skipped: true, reason: "dummy_participant" };
    }

    if (coinsToAdd === 0) {
      console.log(
        `💰 Player ${participant.username} (${participant.playerId}) earned 0 coins - skipping DB update`,
      );
      return { success: true, skipped: true, reason: "zero_coins" };
    }

    // 🔧 CRITICAL FIX: Validate coinsToAdd is a valid multiple of 25
    if (!Number.isInteger(coinsToAdd)) {
      console.error(
        `❌ INVALID COINS: ${participant.username} (${participant.playerId}) - coinsToAdd is not integer: ${coinsToAdd} (type: ${typeof coinsToAdd})`,
      );
      return {
        success: false,
        error: "invalid_coin_amount_not_integer",
        playerId: participant.playerId,
        invalidAmount: coinsToAdd,
      };
    }

    if (coinsToAdd % 25 !== 0) {
      console.error(
        `❌ INVALID COINS: ${participant.username} (${participant.playerId}) - coinsToAdd is not multiple of 25: ${coinsToAdd}`,
      );
      return {
        success: false,
        error: "invalid_coin_amount_not_multiple_of_25",
        playerId: participant.playerId,
        invalidAmount: coinsToAdd,
      };
    }

    if (coinsToAdd < 0 || coinsToAdd > 100) {
      console.error(
        `❌ INVALID COINS: ${participant.username} (${participant.playerId}) - coinsToAdd out of valid range: ${coinsToAdd}`,
      );
      return {
        success: false,
        error: "invalid_coin_amount_out_of_range",
        playerId: participant.playerId,
        invalidAmount: coinsToAdd,
      };
    }

    try {
      console.log(
        `💰 Updating coins for ${participant.username} (${participant.playerId}): +${coinsToAdd} coins`,
      );

      // 🔧 FIX: Get current coin amount first for validation
      const currentResult = await DB.query(
        "SELECT coins FROM players WHERE id = $1",
        [participant.playerId],
      );

      if (currentResult.rows.length === 0) {
        console.error(
          `❌ Player ${participant.playerId} not found in database`,
        );
        return {
          success: false,
          error: "player_not_found",
          playerId: participant.playerId,
        };
      }

      const currentCoins = currentResult.rows[0].coins;
      console.log(
        `📊 ${participant.username} current coins: ${currentCoins}, adding: ${coinsToAdd}, expected total: ${currentCoins + coinsToAdd}`,
      );

      // Execute the SQL UPDATE query
      const result = await DB.query(
        "UPDATE players SET coins = coins + $1 WHERE id = $2 RETURNING id, coins",
        [coinsToAdd, participant.playerId],
      );

      const updatedPlayer = result.rows[0];
      const actualTotal = updatedPlayer.coins;
      const expectedTotal = currentCoins + coinsToAdd;

      // 🔧 CRITICAL: Validate the database update was correct
      if (actualTotal !== expectedTotal) {
        console.error(
          `❌ DATABASE INCONSISTENCY: ${participant.username} (${participant.playerId})`,
        );
        console.error(
          `   Expected total: ${expectedTotal}, Actual total: ${actualTotal}`,
        );
        console.error(
          `   Current: ${currentCoins}, Added: ${coinsToAdd}, Difference: ${actualTotal - expectedTotal}`,
        );

        return {
          success: false,
          error: "database_inconsistency",
          playerId: participant.playerId,
          expected: expectedTotal,
          actual: actualTotal,
          difference: actualTotal - expectedTotal,
        };
      }

      console.log(
        `✅ Successfully updated ${participant.username}: +${coinsToAdd} coins (${currentCoins} → ${actualTotal})`,
      );

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
      console.error(
        `❌ Database error updating coins for player ${participant.playerId}:`,
        error.message,
      );
      return {
        success: false,
        error: "database_error",
        playerId: participant.playerId,
        details: error.message,
      };
    }
  }

  // 🔧 FIXED handleVote method for GameRoom class
  handleVote(voter, votedCatId) {
    if (this.isFinalized) {
      console.log(
        `🚫 Voting already finalized - ignoring vote from ${voter.playerId}`,
      );
      return;
    }

    // 🔧 FIX 1: Validate voter is actually in this game room
    const voterInRoom = this.participants.find(
      (p) => p.playerId === voter.playerId && p.catId === voter.catId,
    );

    if (!voterInRoom) {
      console.log(
        `🚫 ${voter.playerId} not found in game room participants - ignoring vote`,
      );
      return;
    }

    // 🔧 FIX 2: Ensure consistent data types for catId comparison
    const normalizedVotedCatId = parseInt(votedCatId);
    const normalizedVoterCatId = parseInt(voter.catId);

    if (isNaN(normalizedVotedCatId) || isNaN(normalizedVoterCatId)) {
      console.log(
        `🚫 Invalid catId format - voter: ${voter.catId}, voted: ${votedCatId}`,
      );
      return;
    }

    // 🔧 FIX 3: Find target participant with better logging
    console.log(
      `🔍 Looking for target participant with catId: ${normalizedVotedCatId}`,
    );
    console.log(
      `🔍 Available participants:`,
      this.participants.map((p) => ({
        playerId: p.playerId,
        catId: p.catId,
        catName: p.catName,
        catIdParsed: parseInt(p.catId),
      })),
    );

    const targetParticipant = this.participants.find((p) => {
      const participantCatId = parseInt(p.catId);
      return participantCatId === normalizedVotedCatId;
    });

    if (!targetParticipant) {
      console.log(
        `🚫 ${voter.playerId} voted for non-existent cat ${normalizedVotedCatId}`,
      );
      console.log(
        `🚫 Available catIds: ${this.participants.map((p) => parseInt(p.catId)).join(", ")}`,
      );
      return;
    }

    // 🔧 FIX 4: Prevent self-voting (server-side validation)
    if (normalizedVotedCatId === normalizedVoterCatId) {
      console.log(
        `🚫 ${voter.playerId} attempted to vote for own cat ${normalizedVoterCatId}`,
      );
      return;
    }

    const previousVote = voterInRoom.votedCatId; // Use the participant from the room, not the parameter

    // 🔧 FIX 5: Store vote on the actual room participant, not the parameter
    voterInRoom.votedCatId = normalizedVotedCatId;

    if (previousVote) {
      console.log(
        `🔄 ${voterInRoom.playerId} (${voterInRoom.username}) changed vote from ${previousVote} to ${normalizedVotedCatId} (${targetParticipant.catName})`,
      );
    } else {
      console.log(
        `🗳️ ${voterInRoom.playerId} (${voterInRoom.username}) voted for ${normalizedVotedCatId} (${targetParticipant.catName})`,
      );
    }

    // 🔧 FIX 6: Verify the vote was stored correctly
    console.log(
      `📊 Vote confirmation: ${voterInRoom.username} now has votedCatId = ${voterInRoom.votedCatId} (type: ${typeof voterInRoom.votedCatId})`,
    );

    this.broadcastVotingUpdate();

    // Check if all voted for early end
    const allVoted = this.participants.every(
      (p) => p.votedCatId !== null && p.votedCatId !== undefined,
    );
    const votedCount = this.participants.filter(
      (p) => p.votedCatId !== null && p.votedCatId !== undefined,
    ).length;
    const totalCount = this.participants.length;

    console.log(
      `📊 Voting progress: ${votedCount}/${totalCount} participants have voted`,
    );

    // 🔧 FIX 7: Enhanced vote state logging
    console.log("🗳️ Current vote state after vote:");
    this.participants.forEach((p, idx) => {
      const votedForParticipant = this.participants.find(
        (target) => parseInt(target.catId) === parseInt(p.votedCatId),
      );
      const voteDisplay = p.votedCatId
        ? `${p.votedCatId} (${votedForParticipant?.catName || "unknown"})`
        : "NO VOTE";
      const uniqueId = `${p.playerId}-${p.catId}`;
      console.log(
        `  ${idx + 1}. ${p.username} [${uniqueId}] voted for: ${voteDisplay}`,
      );
    });

    if (allVoted) {
      console.log("🚀 ALL PARTICIPANTS VOTED - Ending voting early!");
      console.log("⏰ Early voting end triggered - canceling timer");

      // Clear the voting timer since we're ending early
      if (this.votingTimer) {
        clearTimeout(this.votingTimer);
        this.votingTimer = null;
        console.log("⏹️ Voting timer canceled due to early completion");
      }

      // Add small delay for better UX
      setTimeout(() => {
        console.log("✅ Finalizing voting after early completion");
        this.finalizeVoting();
      }, 1500);
    }
  }

  handleVotingTimeout() {
    if (this.isFinalized) return;

    console.log(
      "⏰ VOTING TIMEOUT REACHED (60 seconds) - Beginning vote calculation process",
    );
    console.log(`📊 Room status at timeout:`, {
      participantCount: this.participants.length,
      votingStartTime: new Date(this.votingStartTime).toISOString(),
      timeElapsed:
        ((Date.now() - this.votingStartTime) / 1000).toFixed(1) + "s",
    });

    // 🔧 DEBUG: Log voting state BEFORE timeout processing
    console.log("🗳️ Vote state BEFORE timeout processing:");
    this.participants.forEach((participant, index) => {
      console.log(
        `  ${index + 1}. ${participant.username} (${participant.playerId}) - Cat: ${participant.catName} (${participant.catId})`,
      );
      console.log(
        `     Current vote: ${participant.votedCatId || "NO VOTE"} (type: ${typeof participant.votedCatId})`,
      );
      console.log(`     Is dummy: ${participant.isDummy || false}`);
    });

    // Assign random votes to non-voters
    console.log("🎲 Checking for participants who need random votes:");
    let autoVotesAssigned = 0;

    this.participants.forEach((participant) => {
      // 🔧 FIX: Be more explicit about vote checking
      const hasVoted =
        participant.votedCatId !== null &&
        participant.votedCatId !== undefined &&
        !isNaN(participant.votedCatId);

      if (!hasVoted) {
        const availableCats = this.participants
          .filter((p) => parseInt(p.catId) !== parseInt(participant.catId))
          .map((p) => parseInt(p.catId));

        if (availableCats.length > 0) {
          const choice =
            availableCats[Math.floor(Math.random() * availableCats.length)];
          participant.votedCatId = choice;
          autoVotesAssigned++;

          const votedForParticipant = this.participants.find(
            (p) => parseInt(p.catId) === choice,
          );
          console.log(
            `  ⚡ Auto-vote: ${participant.username} → ${votedForParticipant?.catName || choice}`,
          );
        }
      } else {
        console.log(
          `  ✅ ${participant.username} already voted for ${participant.votedCatId}`,
        );
      }
    });

    console.log(
      `✅ Assigned ${autoVotesAssigned} automatic votes due to timeout`,
    );

    // 🔧 DEBUG: Log voting state AFTER timeout processing
    console.log("🗳️ Vote state AFTER timeout processing:");
    this.participants.forEach((participant, index) => {
      console.log(
        `  ${index + 1}. ${participant.username} → voted for ${participant.votedCatId}`,
      );
    });

    this.finalizeVoting();
  }

  // 🔧 MODIFIED: finalizeVoting - calculation only, no DB updates
  async finalizeVoting() {
    if (this.isFinalized) return;
    this.isFinalized = true;

    console.log("🏁 FINALIZING VOTING - No more changes allowed");

    // Record finalization time for analytics
    const votingDuration = ((Date.now() - this.votingStartTime) / 1000).toFixed(
      1,
    );
    console.log(`⏱️ Voting lasted ${votingDuration} seconds`);

    // Clear timer if still running
    if (this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
      console.log("⏹️ Voting timer cleared");
    }

    // 🔧 CHANGED: Only calculate results, no database updates yet
    this.calculateResults();

    // Show announcement before results
    console.log('📺 Sending "calculating votes" announcement to participants');
    this.participants.forEach((participant) => {
      if (participant.socket?.connected) {
        participant.socket.emit("calculating_announcement", {
          type: "calculating_announcement",
          message: "CALCULATING VOTES, PLEASE WAIT . . .",
        });
      }
    });

    // 🔧 CRITICAL CHANGE: Database updates happen here, with proper error handling
    setTimeout(async () => {
      console.log("💰 RESULTS CALCULATED - NOW APPLYING DATABASE UPDATES");

      try {
        // 🔧 NEW: Update database with rewards ONLY when about to show results
        const dbUpdateSummary = await this.updateDatabaseWithRewards();

        console.log(
          "📤 Sending final results to all participants (coins processing complete)",
        );

        // 🔧 ENHANCED: Send results with comprehensive error handling
        let resultsMessagesSent = 0;
        let resultsMessagesFailed = 0;

        this.participants.forEach((participant) => {
          if (participant.socket?.connected) {
            try {
              // 🔧 ENHANCED: Validate toast data before sending
              const toastData = participant.toastData || {
                success: false,
                error: "No toast data generated",
                coinsEarned: 0,
                votesReceived: participant.votesReceived || 0,
              };

              // 🔧 VALIDATION: Ensure required fields are present
              if (!toastData.hasOwnProperty("success")) {
                console.warn(
                  `⚠️ Missing 'success' field in toast data for ${participant.username}`,
                );
                toastData.success = false;
                toastData.error = "incomplete_toast_data";
              }

              if (!toastData.hasOwnProperty("coinsEarned")) {
                console.warn(
                  `⚠️ Missing 'coinsEarned' field in toast data for ${participant.username}`,
                );
                toastData.coinsEarned = 0;
              }

              if (!toastData.hasOwnProperty("votesReceived")) {
                console.warn(
                  `⚠️ Missing 'votesReceived' field in toast data for ${participant.username}`,
                );
                toastData.votesReceived = participant.votesReceived || 0;
              }

              const resultsMessage = {
                type: "results",
                participants: this.getParticipantsForClient(),
                toastData: toastData,
              };

              participant.socket.emit("results", resultsMessage);
              resultsMessagesSent++;

              console.log(
                `  ✅ Results sent to ${participant.username} with toast data:`,
                toastData,
              );
            } catch (err) {
              console.error(
                `❌ Failed to send results to ${participant.username}:`,
                err,
              );
              resultsMessagesFailed++;
            }
          } else {
            console.log(
              `  ⚠️ Could not send results to ${participant.username} - socket disconnected`,
            );
            resultsMessagesFailed++;
          }
        });

        console.log(
          `📊 Results delivery summary: ${resultsMessagesSent} sent, ${resultsMessagesFailed} failed`,
        );
        console.log(
          "🎉 GAME ROOM COMPLETE - Results displayed, coins awarded in database",
        );
      } catch (error) {
        console.error("❌ CRITICAL ERROR during database updates:", error);

        // 🔧 NEW: Send error results to participants if DB updates fail completely
        this.participants.forEach((participant) => {
          if (participant.socket?.connected) {
            const errorToastData = {
              success: false,
              error: "database_update_failed",
              coinsEarned: 0,
              votesReceived: participant.votesReceived || 0,
              details: "Server error during coin processing",
            };

            const resultsMessage = {
              type: "results",
              participants: this.getParticipantsForClient(),
              toastData: errorToastData,
            };

            participant.socket.emit("results", resultsMessage);
            console.log(`  ⚠️ Error results sent to ${participant.username}`);
          }
        });
      }
    }, 3000);
  }

  // 🔧 FIXED: calculateResults - CALCULATION ONLY, NO DATABASE UPDATES
  async calculateResults() {
    console.log("🧮 CALCULATING VOTE RESULTS (NO DB UPDATES YET)");
    console.log("=".repeat(50));

    // 🔧 ENHANCED: Log participant data integrity
    console.log("🔍 PARTICIPANT DATA INTEGRITY CHECK:");
    this.participants.forEach((p, idx) => {
      const catIdType = typeof p.catId;
      const catIdParsed = parseInt(p.catId);
      const isValidCatId = !isNaN(catIdParsed) && catIdParsed > 0;

      console.log(`  ${idx + 1}. ${p.username} (playerId: ${p.playerId})`);
      console.log(
        `     catId: ${p.catId} (type: ${catIdType}, parsed: ${catIdParsed}, valid: ${isValidCatId})`,
      );
      console.log(`     isDummy: ${p.isDummy || false}`);

      if (!isValidCatId) {
        console.error(`     ❌ INVALID CATID DETECTED for ${p.username}!`);
      }
    });

    // 🔧 DEBUG: Log all participants and their votes before counting
    console.log("📊 VOTING STATE BEFORE COUNTING:");
    this.participants.forEach((p, idx) => {
      const hasVote = p.votedCatId !== null && p.votedCatId !== undefined;
      const voteType = typeof p.votedCatId;
      const voteParsed = hasVote ? parseInt(p.votedCatId) : "N/A";

      console.log(
        `  ${idx + 1}. ${p.username} voted for: ${hasVote ? p.votedCatId : "NO VOTE"}`,
      );
      console.log(`     Vote type: ${voteType}, parsed: ${voteParsed}`);
    });

    // Count votes with explicit type handling and validation
    const votes = {};
    console.log("📊 DETAILED VOTE COUNTING:");

    this.participants.forEach((voter) => {
      if (
        voter.votedCatId !== null &&
        voter.votedCatId !== undefined &&
        !isNaN(voter.votedCatId)
      ) {
        const votedCatId = parseInt(voter.votedCatId);
        const voteKey = votedCatId.toString();

        // 🔧 ENHANCED: Validate the vote target exists
        const targetParticipant = this.participants.find(
          (p) => parseInt(p.catId) === votedCatId,
        );

        if (!targetParticipant) {
          console.error(
            `  ❌ PHANTOM VOTE: ${voter.username} voted for non-existent cat ${votedCatId}`,
          );
          return; // Skip this vote
        }

        votes[voteKey] = (votes[voteKey] || 0) + 1;

        console.log(
          `  ✅ ${voter.username} → ${targetParticipant.catName} (catId: ${votedCatId}, key: '${voteKey}', count: ${votes[voteKey]})`,
        );
      } else {
        console.log(
          `  ⚠️ ${voter.username} has invalid vote: ${voter.votedCatId} (type: ${typeof voter.votedCatId})`,
        );
      }
    });

    console.log("📈 FINAL VOTE TALLIES:");
    Object.entries(votes).forEach(([catIdStr, voteCount]) => {
      const catId = parseInt(catIdStr);
      const participant = this.participants.find(
        (p) => parseInt(p.catId) === catId,
      );

      // 🔧 VALIDATION: Ensure vote count is integer
      if (!Number.isInteger(voteCount)) {
        console.error(
          `  ❌ NON-INTEGER VOTE COUNT: catId ${catIdStr} has ${voteCount} votes (type: ${typeof voteCount})`,
        );
      }

      console.log(
        `  catId ${catIdStr}: ${voteCount} votes → ${participant?.catName || "Unknown"}`,
      );
    });

    // Calculate rewards with enhanced validation
    console.log("💰 DETAILED REWARD CALCULATION:");
    let totalCoinsDistributed = 0;

    this.participants.forEach((p) => {
      const catId = parseInt(p.catId);
      const catIdKey = catId.toString();

      // 🔧 VALIDATION: Check catId parsing
      if (isNaN(catId)) {
        console.error(
          `  ❌ INVALID CATID: ${p.username} has unparseable catId: ${p.catId}`,
        );
        p.votesReceived = 0;
        p.coinsEarned = 0;
        return;
      }

      p.votesReceived = votes[catIdKey] || 0;
      p.coinsEarned = p.votesReceived * 25;

      // 🔧 CRITICAL VALIDATION: Verify calculation
      const expectedCoins = p.votesReceived * 25;
      if (p.coinsEarned !== expectedCoins) {
        console.error(
          `  ❌ CALCULATION ERROR: ${p.username} - ${p.votesReceived} votes should be ${expectedCoins} coins, got ${p.coinsEarned}`,
        );
      }

      if (!Number.isInteger(p.votesReceived)) {
        console.error(
          `  ❌ NON-INTEGER VOTES: ${p.username} has ${p.votesReceived} votes (type: ${typeof p.votesReceived})`,
        );
      }

      if (!Number.isInteger(p.coinsEarned) || p.coinsEarned % 25 !== 0) {
        console.error(
          `  ❌ INVALID COIN AMOUNT: ${p.username} - ${p.coinsEarned} coins is not valid multiple of 25`,
        );
      }

      totalCoinsDistributed += p.coinsEarned;

      console.log(
        `  💎 ${p.catName} (${p.username}): ${p.votesReceived} votes × 25 = ${p.coinsEarned} coins`,
      );
      console.log(
        `     Key lookup: catId ${catId} → key '${catIdKey}' → votes[key] = ${votes[catIdKey] || 0}`,
      );
    });

    console.log(`🏆 CALCULATION SUMMARY:`);
    console.log(
      `   Total votes cast: ${Object.values(votes).reduce((a, b) => a + b, 0)}`,
    );
    console.log(`   Total coins to distribute: ${totalCoinsDistributed}`);
    console.log(
      `   Expected range: 0-500 coins (5 players × 0-4 votes × 25 coins)`,
    );

    if (totalCoinsDistributed % 25 !== 0) {
      console.error(
        `   ❌ CRITICAL: Total coins ${totalCoinsDistributed} is not multiple of 25!`,
      );
    }

    // Sort by votes for ranking display
    const sortedParticipants = [...this.participants].sort(
      (a, b) => b.votesReceived - a.votesReceived,
    );
    console.log(`🥇 Final rankings:`);
    sortedParticipants.forEach((p, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
      console.log(
        `   ${medal} ${index + 1}. ${p.catName} - ${p.votesReceived} votes = ${p.coinsEarned} coins`,
      );
    });

    // 🔧 CRITICAL CHANGE: NO DATABASE UPDATES HERE
    console.log(
      "💡 CALCULATION COMPLETE - DATABASE UPDATES DEFERRED TO RESULTS DISPLAY",
    );
    console.log("=".repeat(50));
  }

  // 🔧 NEW: Separate function to handle database updates during results display
  async updateDatabaseWithRewards() {
    console.log("💳 APPLYING COIN REWARDS TO DATABASE (RESULTS DISPLAY PHASE)");
    console.log("─".repeat(60));

    const dbUpdateResults = [];
    let successfulUpdates = 0;
    let failedUpdates = 0;
    let skippedUpdates = 0;

    // Update each participant's coins individually with error handling
    for (const participant of this.participants) {
      try {
        // 🔧 FIX: Validate participant data before DB update
        if (
          !participant.playerId ||
          !Number.isInteger(participant.coinsEarned)
        ) {
          console.error(
            `❌ Invalid participant data: ${participant.username} - playerId: ${participant.playerId}, coinsEarned: ${participant.coinsEarned}`,
          );
          participant.toastData = {
            success: false,
            error: "invalid_participant_data",
            coinsEarned: 0,
            votesReceived: participant.votesReceived || 0,
          };
          failedUpdates++;
          continue;
        }

        const updateResult = await this.updatePlayerCoins(
          participant,
          participant.coinsEarned,
        );

        dbUpdateResults.push({
          playerId: participant.playerId,
          username: participant.username,
          coinsEarned: participant.coinsEarned,
          votesReceived: participant.votesReceived || 0, // 🔧 ENSURE votesReceived is always present
          updateResult,
        });

        if (updateResult.success) {
          if (updateResult.skipped) {
            skippedUpdates++;

            // 🔧 ENHANCED: Store complete toast data for skipped updates
            participant.toastData = {
              success: true,
              skipped: true,
              reason: updateResult.reason,
              coinsEarned: participant.coinsEarned,
              votesReceived: participant.votesReceived || 0,
            };
          } else {
            successfulUpdates++;

            // 🔧 ENHANCED: Store complete toast data for successful updates
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

          // 🔧 ENHANCED: Store detailed error toast data for failed updates
          participant.toastData = {
            success: false,
            error: updateResult.error || "unknown_error",
            coinsEarned: 0,
            votesReceived: participant.votesReceived || 0,
            details: updateResult.details || "No additional details",
          };

          // Enhanced detailed logging for validation failures
          if (
            updateResult.error &&
            updateResult.error.includes("invalid_coin_amount")
          ) {
            console.error(
              `🚨 COIN VALIDATION FAILURE: ${participant.username} attempted to receive ${updateResult.invalidAmount} coins`,
            );
            console.error(`   Votes received: ${participant.votesReceived}`);
            console.error(
              `   Calculation: ${participant.votesReceived} × 25 = ${participant.coinsEarned}`,
            );
            console.error(
              `   This indicates a vote counting or calculation bug!`,
            );
          }
        }
      } catch (error) {
        // 🔧 NEW: Catch any unexpected errors during DB update process
        console.error(
          `❌ Unexpected error updating ${participant.username}:`,
          error,
        );
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

    // Log comprehensive update summary
    console.log("💳 DATABASE UPDATE SUMMARY:");
    console.log(`   ✅ Successful updates: ${successfulUpdates}`);
    console.log(`   ⏭️ Skipped updates: ${skippedUpdates}`);
    console.log(`   ❌ Failed updates: ${failedUpdates}`);

    // Enhanced detailed logging
    dbUpdateResults.forEach((result) => {
      const { playerId, username, coinsEarned, updateResult } = result;

      if (updateResult.success && !updateResult.skipped) {
        console.log(
          `   💰 ${username} (${playerId}): +${coinsEarned} coins (${updateResult.previousTotal} → ${updateResult.newTotal})`,
        );
      } else if (updateResult.skipped) {
        console.log(
          `   ⏭️ ${username} (${playerId}): skipped (${updateResult.reason})`,
        );
      } else {
        console.log(
          `   ❌ ${username} (${playerId}): FAILED - ${updateResult.error}`,
        );
        if (updateResult.invalidAmount !== undefined) {
          console.log(`      Invalid amount: ${updateResult.invalidAmount}`);
        }
      }
    });

    if (failedUpdates > 0) {
      console.warn(`⚠️ WARNING: ${failedUpdates} database updates failed!`);
    }

    console.log(
      "✅ DATABASE UPDATES COMPLETE - COINS AWARDED AT RESULTS DISPLAY",
    );
    console.log("─".repeat(60));

    return {
      successfulUpdates,
      failedUpdates,
      skippedUpdates,
      dbUpdateResults,
    };
  }

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

  // 🔥 NEW: Enhanced getParticipantsForClient function - ADD toast data
  getParticipantsForClient() {
    return this.participants.map((p) => {
      // 🔧 VALIDATION: Ensure all required fields are present and valid
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

      // 🔧 VALIDATION: Log any data issues
      if (!p.username || p.username.startsWith("Player_")) {
        console.warn(
          `⚠️ Participant ${p.playerId} has fallback username: ${participantData.username}`,
        );
      }

      if (!p.catName || p.catName.startsWith("Cat_")) {
        console.warn(
          `⚠️ Participant ${p.playerId} has fallback cat name: ${participantData.catName}`,
        );
      }

      if (!p.catSpriteUrl) {
        console.warn(`⚠️ Participant ${p.playerId} has no cat sprite URL`);
      }

      // 🔧 VALIDATION: Ensure vote counts are consistent
      if (p.votesReceived && p.coinsEarned !== p.votesReceived * 25) {
        console.error(
          `❌ INCONSISTENT DATA: ${p.username} - ${p.votesReceived} votes but ${p.coinsEarned} coins (expected ${p.votesReceived * 25})`,
        );
      }

      return participantData;
    });
  }

  handleParticipantDisconnect(p) {
    if (this.isFinalized) return;

    // Mark participant as dummy when they disconnect
    p.isDummy = true;
    console.log(
      `👤 ${p.username} (${p.playerId}) disconnected - marked as dummy (no coin rewards)`,
    );

    // Assign random vote if they haven't voted
    if (!p.votedCatId) {
      const options = this.participants
        .filter((x) => x.catId !== p.catId)
        .map((x) => x.catId);
      if (options.length > 0) {
        const vote = options[Math.floor(Math.random() * options.length)];
        p.votedCatId = vote;
        console.log(
          `⚠️ ${p.playerId} disconnected - voting randomly for ${vote}`,
        );

        const allVoted = this.participants.every((p) => p.votedCatId);
        if (allVoted) {
          this.finalizeVoting();
        } else {
          this.broadcastVotingUpdate();
        }
      }
    }
  }
}

// ─────────────── Broadcast waiting room updates ───────────────
function broadcastWaitingRoomUpdate() {
  console.log(
    `📤 Broadcasting waiting room update to ${waitingRoom.participants.length} participants`,
  );

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
}

// ═══════════════════════════════════════════════════════════════
// MAIN SOCKET SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════

// 🔧 FIXED: Socket setup with proper room assignment and enhanced error handling
export default function setupSocket(io) {
  const playerSockets = new Map();
  const adminSockets = new Set();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // 🔧 FIX: Use a more reliable room tracking system
    let currentParticipant = null;
    let currentGameRoom = null;

    // 🔥 NEW: Enhanced join handler with toast error messages
    socket.on("join", async (message) => {
      console.log("🎭 Fashion Show - Received join:", message);

      // 🔧 ENHANCED: Better validation with specific error messages
      if (!message || typeof message !== "object") {
        console.warn("⚠️ Invalid join message format. Disconnecting.");
        socket.emit("error", {
          message: "Invalid join request format",
          type: "validation_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      if (!message.playerId || !message.catId) {
        console.warn("⚠️ Missing playerId or catId. Disconnecting.");
        socket.emit("error", {
          message: "Invalid join request - missing player or cat data",
          type: "validation_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      // 🔧 ENHANCED: Validate data types
      const playerId = parseInt(message.playerId);
      const catId = parseInt(message.catId);

      if (isNaN(playerId) || isNaN(catId) || playerId <= 0 || catId <= 0) {
        console.warn(
          `⚠️ Invalid playerId or catId format: playerId=${message.playerId}, catId=${message.catId}`,
        );
        socket.emit("error", {
          message: "Invalid player or cat ID format",
          type: "validation_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      try {
        // Validate cat ownership BEFORE creating participant
        const catValidation = await DB.query(
          "SELECT cat_id FROM player_cats WHERE cat_id = $1 AND player_id = $2",
          [catId, playerId],
        );

        if (catValidation.rows.length === 0) {
          console.warn(
            `❌ Player ${playerId} does not own cat ${catId}. Disconnecting.`,
          );
          socket.emit("error", {
            message: "You do not own the selected cat",
            type: "ownership_error",
            severity: "error",
          });
          return socket.disconnect();
        }
      } catch (err) {
        console.error("❌ Database error during cat validation:", err);
        socket.emit("error", {
          message: "Database connection error - please try again",
          type: "database_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      // 🔧 ENHANCED: Better duplicate checking with detailed logging
      const existingParticipant = waitingRoom.participants.find(
        (p) =>
          p.playerId === playerId ||
          (p.playerId === playerId && p.catId === catId),
      );

      if (existingParticipant) {
        console.warn(
          `❌ Player ${playerId} already in waiting room. Existing: playerId=${existingParticipant.playerId}, catId=${existingParticipant.catId}`,
        );
        socket.emit("error", {
          message: "You are already in the waiting room",
          type: "duplicate_join",
          severity: "warning",
        });
        return socket.disconnect();
      }

      try {
        // Create participant with enhanced error handling
        socket.participant = await createParticipant(playerId, catId, socket);
        currentParticipant = socket.participant;

        // 🔧 ENHANCED: Validate participant creation with specific checks
        if (!socket.participant) {
          throw new Error("Participant creation returned null");
        }

        if (
          !socket.participant.username ||
          socket.participant.username.startsWith("Player_")
        ) {
          console.warn(
            `⚠️ Could not load username for player ${playerId}, using fallback`,
          );
        }

        if (
          !socket.participant.catName ||
          socket.participant.catName.startsWith("Cat_")
        ) {
          console.warn(
            `⚠️ Could not load cat name for cat ${catId}, using fallback`,
          );
        }

        if (!socket.participant.catSpriteUrl) {
          console.warn(`⚠️ Could not load cat sprite for cat ${catId}`);
        }

        console.log(
          `✅ Valid participant created for ${socket.participant.playerId}: ${socket.participant.catName}`,
        );
      } catch (err) {
        console.error(
          `❌ Failed to create participant for player ${playerId}, cat ${catId}:`,
          err,
        );
        socket.emit("error", {
          message: "Failed to load your cat data - please try again",
          type: "data_loading_error",
          severity: "error",
        });
        return socket.disconnect();
      }

      // Continue with existing join logic...
      if (
        waitingRoom.participants.length < PARTICIPANTS_IN_ROOM &&
        !waitingRoom.isVoting
      ) {
        waitingRoom.participants.push(socket.participant);
        console.log(
          `👥 Waiting room: ${waitingRoom.participants.length}/${PARTICIPANTS_IN_ROOM}`,
        );

        broadcastWaitingRoomUpdate();

        // Launch game room when full
        if (waitingRoom.participants.length === PARTICIPANTS_IN_ROOM) {
          console.log("🚀 Launching game room");

          // Final validation before game start
          const uniqueParticipants = waitingRoom.participants.filter(
            (p, index, arr) =>
              arr.findIndex(
                (other) =>
                  other.playerId === p.playerId && other.catId === p.catId,
              ) === index,
          );

          if (uniqueParticipants.length !== PARTICIPANTS_IN_ROOM) {
            console.error(
              `❌ Duplicate participants detected! Expected ${PARTICIPANTS_IN_ROOM}, got ${uniqueParticipants.length} unique`,
            );
            // Reset waiting room and disconnect all with error message
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

          const gameRoom = new GameRoom([...uniqueParticipants]);

          // 🔧 FIX: Properly assign game room to all participant sockets
          uniqueParticipants.forEach((p) => {
            if (!p.isDummy && p.socket) {
              p.socket.currentGameRoom = gameRoom;
              console.log(`🔗 Assigned game room to ${p.username}'s socket`);
            }
          });

          // Reset waiting room
          waitingRoom = { participants: [], isVoting: false };
        }
      } else {
        console.warn("❌ Waiting room full or voting. Disconnecting.");
        socket.emit("error", {
          message: "Fashion show room is full - please try again later",
          type: "room_full",
          severity: "info",
        });
        socket.disconnect();
      }
    });

    // 🔧 FIXED: Vote handling with proper room validation and enhanced error messages
    socket.on("vote", (message) => {
      console.log("🗳️ Received vote:", message);

      // Validate we have a participant and game room
      if (!currentParticipant) {
        console.warn("⚠️ Vote received but no participant on socket");
        // 🔥 NEW: Invalid vote state error
        socket.emit("error", {
          message: "Invalid voting state - please refresh",
          type: "vote_error",
          severity: "warning",
        });
        return;
      }

      if (!socket.currentGameRoom) {
        console.warn("⚠️ Vote received but no game room assigned to socket");
        // 🔥 NEW: No game room error
        socket.emit("error", {
          message: "Not connected to game room - please refresh",
          type: "vote_error",
          severity: "warning",
        });
        return;
      }

      if (!(socket.currentGameRoom instanceof GameRoom)) {
        console.warn(
          "⚠️ Vote received but currentGameRoom is not a GameRoom instance",
        );
        // 🔥 NEW: Invalid game room error
        socket.emit("error", {
          message: "Invalid game room state - please refresh",
          type: "vote_error",
          severity: "error",
        });
        return;
      }

      if (socket.currentGameRoom.isFinalized) {
        console.warn("⚠️ Vote received but game room is already finalized");
        // 🔥 NEW: Voting ended error
        socket.emit("error", {
          message: "Voting has already ended",
          type: "vote_too_late",
          severity: "info",
        });
        return;
      }

      console.log(
        `🗳️ Valid vote from ${currentParticipant.username} (${currentParticipant.playerId}) for cat ${message.votedCatId}`,
      );

      // 🔥 NEW: Send vote confirmation to client
      socket.emit("vote_confirmed", {
        type: "vote_confirmed",
        votedCatId: message.votedCatId,
        voterName: currentParticipant.username,
      });

      socket.currentGameRoom.handleVote(currentParticipant, message.votedCatId);
    });

    // 🔥 NEW: Add heartbeat system to detect connection issues
    const heartbeatInterval = setInterval(() => {
      // Send heartbeat to this connected socket if it has a participant
      if (currentParticipant && socket.connected) {
        socket.emit("heartbeat", { timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds

    // 🔥 NEW: Handle heartbeat responses for connection monitoring
    socket.on("heartbeat_response", (data) => {
      // Update last seen timestamp for connection monitoring
      if (currentParticipant) {
        currentParticipant.lastSeen = Date.now();
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // EXISTING TICKET SYSTEM HANDLERS (UNCHANGED)
    // ═══════════════════════════════════════════════════════════════

    //broadcast/////////////

    // Admin sends a broadcast
    // Admin sends a broadcast
    socket.on("adminBroadcast", async ({ message }) => {
      try {
        const insertResult = await DB.query(
          `INSERT INTO broadcasts(body, sent_at) VALUES ($1, NOW()) RETURNING *`,
          [message],
        );
        const broadcast = insertResult.rows[0];

        // Emit to all players
        const playersResult = await DB.query("SELECT id FROM players");
        playersResult.rows.forEach((row) => {
          io.to(`user_${row.id}`).emit("adminBroadcast", {
            message: broadcast.body,
            date: broadcast.sent_at,
          });
        });
      } catch (err) {
        console.error("Error sending broadcast:", err);
      }
    });

    // Admin registers
    socket.on("registerAdmin", () => {
      adminSockets.add(socket.id);
      socket.join("admins");
      console.log(`Admin registered and joined admins room: ${socket.id}`);
    });

    // Player registers and joins all their open ticket rooms
    socket.on("registerPlayer", async (userId) => {
      socket.join(`user_${userId}`);

      playerSockets.set(userId, socket.id);
      console.log(`Registered player ${userId} with socket ${socket.id}`);

      try {
        const result = await DB.query(
          `SELECT ticket_id FROM tickets_table WHERE user_id = $1 AND status = 'open'`,
          [userId],
        );
        result.rows.forEach((row) => {
          const ticketRoom = `ticket_${row.ticket_id}`;
          socket.join(ticketRoom);
          console.log(`Player socket joined ticket room: ${ticketRoom}`);
        });
      } catch (err) {
        console.error("Failed to get player tickets:", err);
      }
    });

    // Admin joins a ticket room
    socket.on("joinTicketRoom", ({ ticketId }) => {
      const roomName = `ticket_${ticketId}`;
      socket.join(roomName);
      console.log(`Admin socket ${socket.id} joined ticket room: ${roomName}`);
    });

    // Player sends message
    socket.on("playerMessage", async ({ ticketId, userId, text }) => {
      const roomName = `ticket_${ticketId}`;
      console.log(
        `Player ${userId} sent message for ticket ${ticketId}: ${text}`,
      );

      try {
        await DB.query(
          `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'user', $2, NOW())`,
          [ticketId, text],
        );
      } catch (err) {
        console.error("Error saving message:", err);
      }

      io.to(roomName).emit("newMessage", {
        sender: "user",
        content: text,
        ticketId,
        userId,
      });
    });

    // Player opens ticket
    socket.on("openTicketRequest", async ({ userId }, callback) => {
      try {
        const result = await DB.query(
          `SELECT * FROM tickets_table WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
          [userId],
        );

        if (result.rows.length > 0) {
          callback({ ticket: result.rows[0] });
        } else {
          const insertResult = await DB.query(
            `INSERT INTO tickets_table (user_id, status) VALUES ($1, 'open') RETURNING *`,
            [userId],
          );

          const newTicket = insertResult.rows[0];

          // To notify all admins of new ticket
          io.to("admins").emit("newTicketCreated", newTicket);

          callback({ ticket: newTicket });
        }
      } catch (err) {
        console.error("Error in openTicketRequest:", err);
        callback({ error: "Failed to open or create ticket" });
      }
    });

    // Admin sends message
    socket.on("adminMessage", async ({ ticketId, text }) => {
      const roomName = `ticket_${ticketId}`;
      console.log(`Admin sent message to ticket ${ticketId}: ${text}`);

      try {
        await DB.query(
          `INSERT INTO messages_table (ticket_id, sender, content, timestamp) VALUES ($1, 'admin', $2, NOW())`,
          [ticketId, text],
        );
      } catch (err) {
        console.error("Error saving message:", err);
      }

      io.to(roomName).emit("newMessage", {
        sender: "admin",
        content: text,
        ticketId,
      });
    });

    // Admin closes ticket via socket
    socket.on("closeTicket", async ({ ticketId }) => {
      try {
        // Update DB
        await DB.query(
          `UPDATE tickets_table SET status = 'closed' WHERE ticket_id = $1`,
          [ticketId],
        );

        console.log(`Ticket ${ticketId} closed by admin.`);

        // Broadcast to all in that ticket room
        io.to(`ticket_${ticketId}`).emit("ticketClosed", { ticketId });
      } catch (err) {
        console.error("Error closing ticket:", err);
        socket.emit("errorMessage", { message: "Failed to close ticket." });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // DISCONNECT HANDLER (UPDATED TO HANDLE BOTH SYSTEMS)
    // ═══════════════════════════════════════════════════════════════

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      // 🔥 NEW: Clean up heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // Handle fashion show disconnect
      if (currentParticipant) {
        // Check if they're in waiting room
        const waitingRoomIdx = waitingRoom.participants.findIndex(
          (p) =>
            p.playerId === currentParticipant.playerId &&
            p.catId === currentParticipant.catId,
        );

        if (waitingRoomIdx > -1) {
          waitingRoom.participants.splice(waitingRoomIdx, 1);
          broadcastWaitingRoomUpdate();
          console.log(`👤 ${currentParticipant.playerId} left waiting room`);
        } else if (socket.currentGameRoom instanceof GameRoom) {
          socket.currentGameRoom.handleParticipantDisconnect(
            currentParticipant,
          );
          console.log(
            `👤 ${currentParticipant.playerId} disconnected during game`,
          );
        }
      }

      // Cleanup admin and player sockets
      adminSockets.delete(socket.id);
      for (const [userId, socketId] of playerSockets.entries()) {
        if (socketId === socket.id) {
          playerSockets.delete(userId);
          break;
        }
      }
    });
  });
}
