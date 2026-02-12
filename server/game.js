/**
 * Game state machine and logic for Find The Imposter.
 *
 * Game phases:
 *   LOBBY → WORD_REVEAL → CLUE_CIRCLE → DISCUSSION → VOTING → RESULTS → TIE_BREAK → ELIMINATION → (next round or GAME_OVER)
 */

const { getWordPair } = require("./words");

// Elimination plan: how many imposters per round based on player count
function getImpostersForRound(playerCount) {
  if (playerCount >= 26) return 4;
  if (playerCount >= 16) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

// Generate a random 4-letter room code
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // No I or O to avoid confusion
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

class Game {
  constructor() {
    this.id = generateRoomCode();
    this.phase = "LOBBY"; // Current game phase
    this.round = 0;
    this.players = new Map(); // playerId -> Player
    this.currentWordPair = null;
    this.votes = new Map(); // voterId -> targetId
    this.usedWordPairs = [];
    this.eliminationHistory = []; // { round, playerId, name, wasImposter }
    this.clueOrder = []; // Shuffled player order for clue circle
    this.currentClueIndex = 0;
    this.tieBreakerCandidates = [];
    this.tieBreakerResult = null;
    this.eliminatedThisRound = [];
    this.settings = {
      wordRevealTime: 10, // seconds
      clueTimePerPlayer: 5, // seconds
      discussionTime: 180, // seconds (3 min)
      votingTime: 120, // seconds (2 min)
    };
  }

  // Add a player to the game
  addPlayer(id, name, socketId) {
    if (this.phase !== "LOBBY") {
      // Allow reconnection
      const existing = this.findPlayerByName(name);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        return existing;
      }
      return null;
    }

    const player = {
      id,
      name: name.trim(),
      socketId,
      isAlive: true,
      isImposter: false,
      word: null,
      hasVoted: false,
      connected: true,
      joinedAt: Date.now(),
    };
    this.players.set(id, player);
    return player;
  }

  findPlayerByName(name) {
    for (const player of this.players.values()) {
      if (player.name.toLowerCase() === name.trim().toLowerCase()) {
        return player;
      }
    }
    return null;
  }

  // Reconnect a player
  reconnectPlayer(playerId, socketId) {
    const player = this.players.get(playerId);
    if (player) {
      player.socketId = socketId;
      player.connected = true;
      return player;
    }
    return null;
  }

  // Disconnect a player (don't eliminate)
  disconnectPlayer(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.connected = false;
        return player;
      }
    }
    return null;
  }

  // Get alive players
  getAlivePlayers() {
    return Array.from(this.players.values()).filter((p) => p.isAlive);
  }

  // Get all players as array
  getAllPlayers() {
    return Array.from(this.players.values());
  }

  // Get player count
  getAliveCount() {
    return this.getAlivePlayers().length;
  }

  // Start a new round
  startRound() {
    this.round++;
    this.votes.clear();
    this.eliminatedThisRound = [];
    this.tieBreakerCandidates = [];
    this.tieBreakerResult = null;
    this.currentClueIndex = 0;

    const alivePlayers = this.getAlivePlayers();
    const imposterCount = this.getImpostersThisRound();

    // Check if this is the final round (3 players)
    const isFinalRound = alivePlayers.length <= 3;

    // Pick word pair
    this.currentWordPair = getWordPair(this.round, this.usedWordPairs);
    this.usedWordPairs.push(this.currentWordPair.pairKey);

    // Reset player states
    alivePlayers.forEach((p) => {
      p.isImposter = false;
      p.word = null;
      p.hasVoted = false;
    });

    // Randomly assign imposters
    const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5);
    const imposters = shuffled.slice(0, imposterCount);
    const mainPlayers = shuffled.slice(imposterCount);

    imposters.forEach((p) => {
      p.isImposter = true;
      p.word = this.currentWordPair.imposterWord;
    });

    mainPlayers.forEach((p) => {
      p.isImposter = false;
      p.word = this.currentWordPair.mainWord;
    });

    // Generate random clue order
    this.clueOrder = [...alivePlayers].sort(() => Math.random() - 0.5).map((p) => p.id);

    this.phase = "WORD_REVEAL";

    return {
      round: this.round,
      aliveCount: alivePlayers.length,
      imposterCount,
      difficulty: this.currentWordPair.difficulty,
      isFinalRound,
    };
  }

  // Get number of imposters for this round
  getImpostersThisRound() {
    const aliveCount = this.getAliveCount();
    if (aliveCount <= 3) return 1; // Final round
    return getImpostersForRound(aliveCount);
  }

  // Get number to eliminate this round
  getEliminationCount() {
    const aliveCount = this.getAliveCount();
    if (aliveCount <= 3) return 1; // Final round
    return this.getImpostersThisRound();
  }

  // Advance to clue circle phase
  startClueCircle() {
    this.phase = "CLUE_CIRCLE";
    this.currentClueIndex = 0;
    return {
      order: this.clueOrder.map((id) => {
        const p = this.players.get(id);
        return { id: p.id, name: p.name };
      }),
      currentIndex: 0,
    };
  }

  // Advance to next player in clue circle
  nextCluePlayer() {
    this.currentClueIndex++;
    if (this.currentClueIndex >= this.clueOrder.length) {
      return { done: true };
    }
    return {
      done: false,
      currentIndex: this.currentClueIndex,
      player: (() => {
        const p = this.players.get(this.clueOrder[this.currentClueIndex]);
        return { id: p.id, name: p.name };
      })(),
    };
  }

  // Start discussion phase
  startDiscussion() {
    this.phase = "DISCUSSION";
  }

  // Start voting phase
  startVoting() {
    this.phase = "VOTING";
    this.votes.clear();
    this.getAlivePlayers().forEach((p) => (p.hasVoted = false));
  }

  // Cast a vote
  castVote(voterId, targetId) {
    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);

    if (!voter || !target) return { error: "Invalid player" };
    if (!voter.isAlive) return { error: "You are eliminated" };
    if (!target.isAlive) return { error: "Target is eliminated" };
    if (voterId === targetId) return { error: "Cannot vote for yourself" };
    if (voter.hasVoted) return { error: "Already voted" };

    this.votes.set(voterId, targetId);
    voter.hasVoted = true;

    return {
      success: true,
      votedCount: this.votes.size,
      totalAlive: this.getAliveCount(),
    };
  }

  // Tally votes and determine eliminations
  tallyVotes() {
    this.phase = "RESULTS";
    const eliminateCount = this.getEliminationCount();

    // Count votes per player
    const voteCounts = new Map();
    this.getAlivePlayers().forEach((p) => voteCounts.set(p.id, 0));

    for (const targetId of this.votes.values()) {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    }

    // Sort by vote count descending
    const sorted = Array.from(voteCounts.entries())
      .map(([id, count]) => ({
        id,
        name: this.players.get(id).name,
        votes: count,
        isImposter: this.players.get(id).isImposter,
      }))
      .sort((a, b) => b.votes - a.votes);

    // Determine who gets eliminated
    const toEliminate = [];
    const tieBreakNeeded = [];

    // Find the vote threshold
    let eliminated = 0;
    let i = 0;

    while (eliminated < eliminateCount && i < sorted.length) {
      const currentVotes = sorted[i].votes;

      // Find all players with this vote count
      const sameVoteGroup = sorted.filter((p) => p.votes === currentVotes);
      const sameVoteNotYetEliminated = sameVoteGroup.filter(
        (p) => !toEliminate.find((e) => e.id === p.id)
      );

      if (eliminated + sameVoteNotYetEliminated.length <= eliminateCount) {
        // All of them can be eliminated
        toEliminate.push(...sameVoteNotYetEliminated);
        eliminated += sameVoteNotYetEliminated.length;
        i += sameVoteNotYetEliminated.length;
      } else {
        // Tie! Need tie-breaker for this group
        const spotsLeft = eliminateCount - eliminated;
        this.tieBreakerCandidates = sameVoteNotYetEliminated.map((p) => ({
          id: p.id,
          name: p.name,
          votes: p.votes,
          isImposter: p.isImposter,
        }));
        this.tieBreakerSpotsNeeded = spotsLeft;
        break;
      }
    }

    this.eliminatedThisRound = toEliminate;

    return {
      voteTally: sorted,
      toEliminate,
      needsTieBreak: this.tieBreakerCandidates.length > 0,
      tieBreakerCandidates: this.tieBreakerCandidates,
      tieBreakerSpotsNeeded: this.tieBreakerSpotsNeeded || 0,
    };
  }

  // Resolve tie-breaker (server picks randomly, animation is client-side)
  resolveTieBreak() {
    this.phase = "TIE_BREAK";
    const candidates = [...this.tieBreakerCandidates];
    const spotsNeeded = this.tieBreakerSpotsNeeded;

    // Randomly pick from tied candidates
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const tieEliminated = shuffled.slice(0, spotsNeeded);

    this.tieBreakerResult = tieEliminated;
    this.eliminatedThisRound.push(...tieEliminated);

    return {
      candidates,
      eliminated: tieEliminated,
    };
  }

  // Execute eliminations
  executeEliminations() {
    this.phase = "ELIMINATION";

    const results = this.eliminatedThisRound.map((e) => {
      const player = this.players.get(e.id);
      player.isAlive = false;

      const result = {
        id: player.id,
        name: player.name,
        wasImposter: player.isImposter,
        word: player.word,
        round: this.round,
      };

      this.eliminationHistory.push(result);
      return result;
    });

    // Check if game should end
    const aliveCount = this.getAliveCount();
    const isFinalRound = aliveCount <= 2;

    let gameOver = null;
    if (isFinalRound) {
      gameOver = this.determineWinner();
    }

    return {
      eliminated: results,
      remainingPlayers: aliveCount,
      gameOver,
    };
  }

  // Determine the winner (called at end of final round)
  determineWinner() {
    this.phase = "GAME_OVER";

    const alivePlayers = this.getAlivePlayers();

    // Check if the last eliminated player (from final round vote) was the imposter
    const lastEliminated = this.eliminatedThisRound[this.eliminatedThisRound.length - 1];
    const imposterCaught = lastEliminated && lastEliminated.isImposter;

    if (imposterCaught) {
      // Main team wins - the survivors caught the imposter
      return {
        winner: "MAIN_TEAM",
        message: "The imposter has been caught! Main team wins!",
        survivors: alivePlayers.map((p) => ({ id: p.id, name: p.name })),
        imposter: {
          id: lastEliminated.id,
          name: lastEliminated.name,
        },
      };
    } else {
      // Imposter wins - they survived
      const imposter = alivePlayers.find((p) => p.isImposter);
      return {
        winner: "IMPOSTER",
        message: "The imposter survived! Imposter wins!",
        survivors: alivePlayers.map((p) => ({ id: p.id, name: p.name })),
        imposter: imposter
          ? { id: imposter.id, name: imposter.name }
          : null,
      };
    }
  }

  // Manually eliminate a player (rule breaker)
  kickPlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.isAlive = false;
      this.eliminationHistory.push({
        id: player.id,
        name: player.name,
        wasImposter: player.isImposter,
        word: player.word,
        round: this.round,
        kicked: true,
      });
      return player;
    }
    return null;
  }

  // Reset game to lobby (restart with same players and room code)
  reset() {
    this.phase = "LOBBY";
    this.round = 0;
    this.currentWordPair = null;
    this.votes.clear();
    this.usedWordPairs = [];
    this.eliminationHistory = [];
    this.clueOrder = [];
    this.currentClueIndex = 0;
    this.tieBreakerCandidates = [];
    this.tieBreakerResult = null;
    this.eliminatedThisRound = [];

    // Reset all players to alive
    for (const player of this.players.values()) {
      player.isAlive = true;
      player.isImposter = false;
      player.word = null;
      player.hasVoted = false;
    }
  }

  // Update game settings
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
  }

  // Get game state for host display
  getHostState() {
    return {
      id: this.id,
      phase: this.phase,
      round: this.round,
      settings: this.settings,
      players: this.getAllPlayers().map((p) => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        connected: p.connected,
        hasVoted: p.hasVoted,
      })),
      aliveCount: this.getAliveCount(),
      totalPlayers: this.players.size,
      impostersThisRound: this.phase !== "LOBBY" ? this.getImpostersThisRound() : 0,
      eliminateCount: this.phase !== "LOBBY" ? this.getEliminationCount() : 0,
      clueOrder: this.clueOrder.map((id) => {
        const p = this.players.get(id);
        return p ? { id: p.id, name: p.name } : null;
      }).filter(Boolean),
      currentClueIndex: this.currentClueIndex,
      currentWordPair: this.currentWordPair
        ? {
            difficulty: this.currentWordPair.difficulty,
            // Don't send actual words to host display
          }
        : null,
      eliminationHistory: this.eliminationHistory,
    };
  }

  // Get game state for moderator
  getModeratorState() {
    return {
      ...this.getHostState(),
      currentWordPair: this.currentWordPair, // Moderator sees the words
      players: this.getAllPlayers().map((p) => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isImposter: p.isImposter,
        word: p.word,
        connected: p.connected,
        hasVoted: p.hasVoted,
      })),
    };
  }

  // Get game state for a specific player
  getPlayerState(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;

    return {
      id: this.id,
      phase: this.phase,
      round: this.round,
      you: {
        id: player.id,
        name: player.name,
        isAlive: player.isAlive,
        hasVoted: player.hasVoted,
      },
      alivePlayers: this.getAlivePlayers().map((p) => ({
        id: p.id,
        name: p.name,
      })),
      aliveCount: this.getAliveCount(),
      totalPlayers: this.players.size,
      settings: this.settings,
    };
  }
}

module.exports = { Game, generateRoomCode };
