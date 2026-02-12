/**
 * Find The Imposter - Server
 * Express + Socket.IO server handling game logic, real-time communication,
 * and serving static files.
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const QRCode = require("qrcode");
const os = require("os");
const { Game } = require("./game");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.get("/", (req, res) => {
  res.redirect("/play");
});

app.get("/play", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/player.html"));
});

app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/host.html"));
});

app.get("/moderator", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/moderator.html"));
});

// QR Code endpoint
app.get("/api/qrcode/:roomCode", async (req, res) => {
  try {
    // Detect the correct base URL: use the request's Host header so it works
    // both locally (http://192.168.x.x:3000) and on cloud (https://app.railway.app)
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers.host; // includes port if non-standard
    const url = `${protocol}://${host}/play?room=${req.params.roomCode}`;
    const qr = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#00ffff", light: "#00000000" },
    });
    res.json({ qr, url });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// Get local IP for QR code generation
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// ========== Game State ==========
const games = new Map(); // roomCode -> Game

// ========== Socket.IO ==========
io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  // ---------- Moderator Events ----------

  // Create a new game
  socket.on("create-game", (callback) => {
    const game = new Game();
    games.set(game.id, game);
    socket.join(`game:${game.id}`);
    socket.join(`moderator:${game.id}`);
    socket.gameId = game.id;
    socket.role = "moderator";
    console.log(`Game created: ${game.id}`);
    callback({ success: true, gameId: game.id });
    emitHostUpdate(game);
  });

  // Update settings
  socket.on("update-settings", ({ gameId, settings }) => {
    const game = games.get(gameId);
    if (!game) return;
    game.updateSettings(settings);
    emitHostUpdate(game);
    emitModeratorUpdate(game);
  });

  // Start round
  socket.on("start-round", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const roundInfo = game.startRound();

    // Send word to each player individually
    for (const player of game.getAlivePlayers()) {
      io.to(player.socketId).emit("word-reveal", {
        word: player.word,
        duration: game.settings.wordRevealTime,
        round: game.round,
        isImposter: player.isImposter, // Player doesn't know, but we track
      });
    }

    // Tell host to show word reveal phase
    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "WORD_REVEAL",
      round: game.round,
      aliveCount: roundInfo.aliveCount,
      imposterCount: roundInfo.imposterCount,
      difficulty: roundInfo.difficulty,
      isFinalRound: roundInfo.isFinalRound,
      duration: game.settings.wordRevealTime,
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    // Don't call emitAllPlayersUpdate here — the word-reveal event
    // already handles the player screen. Sending player-state would
    // race and override the word display with the "word gone" lock screen.
  });

  // Start clue circle
  socket.on("start-clue-circle", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const clueData = game.startClueCircle();

    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "CLUE_CIRCLE",
      order: clueData.order,
      currentIndex: 0,
      clueTime: game.settings.clueTimePerPlayer,
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);
  });

  // Next clue player
  socket.on("next-clue-player", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const result = game.nextCluePlayer();

    io.to(`host:${game.id}`).emit("clue-next", {
      done: result.done,
      currentIndex: game.currentClueIndex,
      player: result.player || null,
      clueTime: game.settings.clueTimePerPlayer,
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
  });

  // Start discussion
  socket.on("start-discussion", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    game.startDiscussion();

    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "DISCUSSION",
      duration: game.settings.discussionTime,
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);
  });

  // Start voting
  socket.on("start-voting", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    game.startVoting();

    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "VOTING",
      duration: game.settings.votingTime,
    });

    // Send voting UI to each alive player
    for (const player of game.getAlivePlayers()) {
      io.to(player.socketId).emit("voting-open", {
        alivePlayers: game
          .getAlivePlayers()
          .filter((p) => p.id !== player.id)
          .map((p) => ({ id: p.id, name: p.name })),
        duration: game.settings.votingTime,
      });
    }

    emitHostUpdate(game);
    emitModeratorUpdate(game);
  });

  // Close voting and show results
  socket.on("close-voting", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const results = game.tallyVotes();

    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "RESULTS",
      voteTally: results.voteTally,
      toEliminate: results.toEliminate.map((p) => ({
        id: p.id,
        name: p.name,
        votes: p.votes,
      })),
      needsTieBreak: results.needsTieBreak,
      tieBreakerCandidates: results.tieBreakerCandidates.map((p) => ({
        id: p.id,
        name: p.name,
        votes: p.votes,
      })),
      tieBreakerSpotsNeeded: results.tieBreakerSpotsNeeded,
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);
  });

  // Resolve tie-break
  socket.on("resolve-tiebreak", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const result = game.resolveTieBreak();

    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "TIE_BREAK",
      candidates: result.candidates.map((p) => ({
        id: p.id,
        name: p.name,
      })),
      eliminated: result.eliminated.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
  });

  // Execute eliminations
  socket.on("execute-eliminations", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const result = game.executeEliminations();

    io.to(`host:${game.id}`).emit("phase-change", {
      phase: "ELIMINATION",
      eliminated: result.eliminated,
      remainingPlayers: result.remainingPlayers,
      gameOver: result.gameOver,
      mainWord: game.currentWordPair.mainWord,
      imposterWord: game.currentWordPair.imposterWord,
    });

    // Notify eliminated players
    for (const e of result.eliminated) {
      const player = game.players.get(e.id);
      if (player) {
        io.to(player.socketId).emit("you-eliminated", {
          wasImposter: e.wasImposter,
          word: e.word,
        });
      }
    }

    if (result.gameOver) {
      io.to(`host:${game.id}`).emit("game-over", result.gameOver);
      emitAllPlayersUpdate(game);
    }

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);
  });

  // Restart game (same room, same players, fresh game)
  socket.on("restart-game", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    game.reset();

    // Notify all clients about the restart
    io.to(`host:${game.id}`).emit("game-restart");
    io.to(`player:${game.id}`).emit("game-restart");

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);

    console.log(`Game ${game.id} restarted`);
  });

  // Kick a player
  socket.on("kick-player", ({ gameId, playerId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.kickPlayer(playerId);
    if (player) {
      io.to(player.socketId).emit("you-eliminated", {
        kicked: true,
        wasImposter: player.isImposter,
        word: player.word,
      });

      io.to(`host:${game.id}`).emit("player-kicked", {
        name: player.name,
      });
    }

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);
  });

  // ---------- Host Events ----------

  socket.on("join-host", ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit("error-msg", { message: "Game not found" });
      return;
    }
    socket.join(`host:${game.id}`);
    socket.gameId = game.id;
    socket.role = "host";
    emitHostUpdate(game);
  });

  // ---------- Player Events ----------

  // Join a game
  socket.on("join-game", ({ gameId, playerName, playerId }, callback) => {
    const code = gameId.toUpperCase().trim();
    const game = games.get(code);

    if (!game) {
      callback({ success: false, error: "Game not found. Check the room code." });
      return;
    }

    // Check for reconnection
    if (playerId) {
      const existing = game.reconnectPlayer(playerId, socket.id);
      if (existing) {
        socket.join(`game:${game.id}`);
        socket.join(`player:${game.id}`);
        socket.gameId = game.id;
        socket.playerId = existing.id;
        socket.role = "player";

        callback({
          success: true,
          playerId: existing.id,
          gameId: game.id,
          playerState: game.getPlayerState(existing.id),
          reconnected: true,
        });

        emitHostUpdate(game);
        emitModeratorUpdate(game);
        return;
      }
    }

    // Check for duplicate name
    const existingByName = game.findPlayerByName(playerName);
    if (existingByName && existingByName.connected) {
      callback({
        success: false,
        error: "That name is already taken. Choose a different name.",
      });
      return;
    }

    // Reconnect by name if disconnected
    if (existingByName && !existingByName.connected) {
      existingByName.socketId = socket.id;
      existingByName.connected = true;
      socket.join(`game:${game.id}`);
      socket.join(`player:${game.id}`);
      socket.gameId = game.id;
      socket.playerId = existingByName.id;
      socket.role = "player";

      callback({
        success: true,
        playerId: existingByName.id,
        gameId: game.id,
        playerState: game.getPlayerState(existingByName.id),
        reconnected: true,
      });

      emitHostUpdate(game);
      emitModeratorUpdate(game);
      return;
    }

    // New player
    const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const player = game.addPlayer(id, playerName, socket.id);

    if (!player) {
      callback({ success: false, error: "Game already started. Cannot join." });
      return;
    }

    socket.join(`game:${game.id}`);
    socket.join(`player:${game.id}`);
    socket.gameId = game.id;
    socket.playerId = id;
    socket.role = "player";

    callback({
      success: true,
      playerId: id,
      gameId: game.id,
      playerState: game.getPlayerState(id),
    });

    // Notify host of new player
    io.to(`host:${game.id}`).emit("player-joined", {
      name: player.name,
      totalPlayers: game.players.size,
    });

    emitHostUpdate(game);
    emitModeratorUpdate(game);
    emitAllPlayersUpdate(game);
  });

  // Cast vote
  socket.on("cast-vote", ({ gameId, targetId }, callback) => {
    const game = games.get(gameId);
    if (!game) return;

    const result = game.castVote(socket.playerId, targetId);
    callback(result);

    if (result.success) {
      // Update vote count on host
      io.to(`host:${game.id}`).emit("vote-update", {
        votedCount: result.votedCount,
        totalAlive: result.totalAlive,
      });

      emitModeratorUpdate(game);
    }
  });

  // ---------- Disconnect ----------

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    if (socket.gameId) {
      const game = games.get(socket.gameId);
      if (game) {
        const player = game.disconnectPlayer(socket.id);
        if (player) {
          io.to(`host:${game.id}`).emit("player-disconnected", {
            name: player.name,
          });
          emitHostUpdate(game);
          emitModeratorUpdate(game);
        }
      }
    }
  });
});

// ========== Helper Functions ==========

function emitHostUpdate(game) {
  io.to(`host:${game.id}`).emit("game-state", game.getHostState());
}

function emitModeratorUpdate(game) {
  io.to(`moderator:${game.id}`).emit("game-state", game.getModeratorState());
}

function emitAllPlayersUpdate(game) {
  for (const player of game.getAllPlayers()) {
    if (player.connected) {
      io.to(player.socketId).emit("player-state", game.getPlayerState(player.id));
    }
  }
}

// ========== Start Server ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`\n🎭 FIND THE IMPOSTER - Server Running!\n`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}\n`);
  console.log(`   Host Display:      http://${localIP}:${PORT}/host`);
  console.log(`   Moderator Controls: http://${localIP}:${PORT}/moderator`);
  console.log(`   Player Join:       http://${localIP}:${PORT}/play\n`);
});
