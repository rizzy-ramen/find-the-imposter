/**
 * Host Display - The dramatic projected screen.
 * Handles all visual phases, animations, countdowns, and sound effects.
 */

(function () {
  "use strict";

  const socket = io();

  // State
  let currentGameId = null;
  let gameState = null;
  let countdownInterval = null;
  let clueTimerInterval = null;
  let discussionInterval = null;

  // Elements
  const hostScreens = document.querySelectorAll(".host-screen");
  const headerRoundInfo = document.getElementById("header-round-info");
  const headerPlayerCount = document.getElementById("header-player-count");

  // Lobby
  const hostRoomCode = document.getElementById("host-room-code");
  const qrCodeImg = document.getElementById("qr-code-img");
  const joinUrl = document.getElementById("join-url");
  const hostLobbyCount = document.getElementById("host-lobby-count");
  const hostPlayersGrid = document.getElementById("host-players-grid");

  // Word reveal
  const hostWordCountdown = document.getElementById("host-word-countdown");

  // Clue circle
  const speakerName = document.getElementById("speaker-name");
  const clueTimerNumber = document.getElementById("clue-timer-number");
  const clueTimerFill = document.getElementById("clue-timer-fill");
  const clueProgress = document.getElementById("clue-progress");
  const upNextQueue = document.getElementById("up-next-queue");

  // Discussion
  const discussionTimer = document.getElementById("discussion-timer");

  // Voting
  const hostVoteProgress = document.getElementById("host-vote-progress");

  // Results
  const voteBars = document.getElementById("vote-bars");

  // Tie breaker
  const tiebreakWheel = document.getElementById("tiebreak-wheel");
  const tiebreakResult = document.getElementById("tiebreak-result");
  const tiebreakTitle = document.getElementById("tiebreak-title");

  // Elimination
  const eliminationCards = document.getElementById("elimination-cards");
  const revealMainWord = document.getElementById("reveal-main-word");
  const revealImposterWord = document.getElementById("reveal-imposter-word");
  const elimRemaining = document.getElementById("elim-remaining");

  // Game over
  const gameoverTitle = document.getElementById("gameover-title");
  const gameoverMessage = document.getElementById("gameover-message");
  const gameoverSurvivors = document.getElementById("gameover-survivors");

  // Scoreboard
  const scoreboardPanel = document.getElementById("scoreboard-panel");
  const scoreboardList = document.getElementById("scoreboard-list");
  const btnToggleScoreboard = document.getElementById("btn-toggle-scoreboard");

  // ---- Audio System ----
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playSound(type) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      switch (type) {
        case "tick":
          osc.frequency.value = 1000;
          gain.gain.value = 0.08;
          osc.start();
          osc.stop(audioCtx.currentTime + 0.08);
          break;
        case "tickLow":
          osc.frequency.value = 600;
          gain.gain.value = 0.06;
          osc.start();
          osc.stop(audioCtx.currentTime + 0.08);
          break;
        case "warning":
          osc.frequency.value = 500;
          osc.type = "square";
          gain.gain.value = 0.1;
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
          break;
        case "danger":
          osc.frequency.value = 300;
          osc.type = "sawtooth";
          gain.gain.value = 0.12;
          osc.start();
          osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.3);
          osc.stop(audioCtx.currentTime + 0.3);
          break;
        case "reveal":
          osc.frequency.value = 500;
          gain.gain.value = 0.1;
          osc.start();
          osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);
          osc.stop(audioCtx.currentTime + 0.3);
          break;
        case "drumroll": {
          // Simulate drumroll with rapid oscillator bursts
          for (let i = 0; i < 20; i++) {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.frequency.value = 150 + Math.random() * 100;
            o.type = "triangle";
            g.gain.value = 0.05;
            o.start(audioCtx.currentTime + i * 0.08);
            o.stop(audioCtx.currentTime + i * 0.08 + 0.05);
          }
          break;
        }
        case "suspense": {
          osc.frequency.value = 100;
          osc.type = "sine";
          gain.gain.value = 0.08;
          osc.start();
          osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 2);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 2);
          gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5);
          osc.stop(audioCtx.currentTime + 2.5);
          break;
        }
        case "imposterReveal": {
          osc.frequency.value = 200;
          osc.type = "sawtooth";
          gain.gain.value = 0.15;
          osc.start();
          osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
          osc.stop(audioCtx.currentTime + 0.6);
          break;
        }
        case "innocentReveal": {
          osc.frequency.value = 400;
          gain.gain.value = 0.1;
          osc.start();
          osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
          osc.stop(audioCtx.currentTime + 0.4);
          break;
        }
        case "victory": {
          const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
          notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.frequency.value = freq;
            g.gain.value = 0.1;
            o.start(audioCtx.currentTime + i * 0.2);
            o.stop(audioCtx.currentTime + i * 0.2 + 0.3);
          });
          break;
        }
        case "defeat": {
          const notes = [400, 350, 300, 200];
          notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.frequency.value = freq;
            o.type = "sawtooth";
            g.gain.value = 0.1;
            o.start(audioCtx.currentTime + i * 0.3);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.3 + 0.4);
            o.stop(audioCtx.currentTime + i * 0.3 + 0.4);
          });
          break;
        }
        case "nextPlayer": {
          osc.frequency.value = 700;
          gain.gain.value = 0.08;
          osc.start();
          osc.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.1);
          osc.stop(audioCtx.currentTime + 0.12);
          break;
        }
        case "timeUp": {
          osc.frequency.value = 800;
          osc.type = "square";
          gain.gain.value = 0.12;
          osc.start();
          osc.stop(audioCtx.currentTime + 0.5);
          break;
        }
        case "spinWheel": {
          osc.frequency.value = 300;
          osc.type = "sine";
          gain.gain.value = 0.08;
          osc.start();
          osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 2);
          osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 3.5);
          gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 4);
          osc.stop(audioCtx.currentTime + 4);
          break;
        }
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  // Resume audio context on interaction
  document.addEventListener("click", () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
  }, { once: true });

  // ---- Screen Management ----

  function showHostScreen(id) {
    hostScreens.forEach((s) => s.classList.remove("active"));
    const screen = document.getElementById(`host-${id}`);
    if (screen) screen.classList.add("active");
  }

  // ---- Scoreboard Toggle ----
  btnToggleScoreboard.addEventListener("click", () => {
    scoreboardPanel.classList.toggle("open");
  });

  function updateScoreboard(players, eliminationHistory) {
    scoreboardList.innerHTML = "";
    if (!players) return;

    players.forEach((p) => {
      const div = document.createElement("div");
      div.className = `scoreboard-entry ${p.isAlive ? "alive" : "dead"}`;

      const elimInfo = eliminationHistory
        ? eliminationHistory.find((e) => e.id === p.id)
        : null;

      div.innerHTML = `
        <span>${p.name} ${!p.connected && p.isAlive ? '<span class="badge badge-disconnected" style="font-size:0.6rem;">DC</span>' : ""}</span>
        ${elimInfo ? `<span class="round-eliminated">R${elimInfo.round}</span>` : ""}
      `;
      scoreboardList.appendChild(div);
    });
  }

  // ---- Socket Events ----

  // Listen for game state updates
  socket.on("game-state", (state) => {
    gameState = state;
    currentGameId = state.id;

    // Update header
    if (state.round > 0) {
      headerRoundInfo.textContent = `ROUND ${state.round}`;
    } else {
      headerRoundInfo.textContent = "";
    }
    headerPlayerCount.textContent = `${state.aliveCount} / ${state.totalPlayers} alive`;

    // Update scoreboard
    updateScoreboard(state.players, state.eliminationHistory);

    // Handle lobby state
    if (state.phase === "LOBBY") {
      showHostScreen("lobby");
      hostRoomCode.textContent = state.id;
      hostLobbyCount.textContent = state.totalPlayers;

      // Load QR code
      fetch(`/api/qrcode/${state.id}`)
        .then((r) => r.json())
        .then((data) => {
          qrCodeImg.src = data.qr;
          joinUrl.textContent = data.url;
        })
        .catch(() => {});

      // Update players grid
      hostPlayersGrid.innerHTML = "";
      state.players.forEach((p) => {
        const chip = document.createElement("div");
        chip.className = "player-chip";
        chip.textContent = p.name;
        chip.style.animationDelay = `${Math.random() * 0.3}s`;
        hostPlayersGrid.appendChild(chip);
      });
    }
  });

  // Player joined animation
  socket.on("player-joined", (data) => {
    if (!gameState || gameState.phase !== "LOBBY") return;

    hostLobbyCount.textContent = data.totalPlayers;

    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.textContent = data.name;
    hostPlayersGrid.appendChild(chip);

    playSound("reveal");
  });

  // Player disconnected
  socket.on("player-disconnected", (data) => {
    // Will be reflected in next game-state update
  });

  // Player kicked
  socket.on("player-kicked", (data) => {
    playSound("imposterReveal");
  });

  // ---- Phase Changes ----

  socket.on("phase-change", (data) => {
    clearAllTimers();

    switch (data.phase) {
      case "WORD_REVEAL":
        handleWordReveal(data);
        break;
      case "CLUE_CIRCLE":
        handleClueCircle(data);
        break;
      case "DISCUSSION":
        handleDiscussion(data);
        break;
      case "VOTING":
        handleVoting(data);
        break;
      case "RESULTS":
        handleResults(data);
        break;
      case "TIE_BREAK":
        handleTieBreak(data);
        break;
      case "ELIMINATION":
        handleElimination(data);
        break;
    }
  });

  // ---- Phase Handlers ----

  function handleWordReveal(data) {
    showHostScreen("word-reveal");

    // Show round info briefly
    const roundBanner = `ROUND ${data.round} — ${data.aliveCount} PLAYERS — ${data.imposterCount} IMPOSTER${data.imposterCount > 1 ? "S" : ""}`;
    headerRoundInfo.textContent = roundBanner;

    if (data.isFinalRound) {
      hostWordCountdown.style.color = "var(--accent-red)";
      document.querySelector("#host-word-reveal .phase-title").textContent = "⚠️ FINAL ROUND — CHECK YOUR SCREENS";
    } else {
      hostWordCountdown.style.color = "";
      document.querySelector("#host-word-reveal .phase-title").textContent = "CHECK YOUR SCREENS NOW";
    }

    let remaining = data.duration;
    hostWordCountdown.textContent = remaining;
    hostWordCountdown.className = "big-countdown";

    playSound("tick");

    countdownInterval = setInterval(() => {
      remaining--;
      hostWordCountdown.textContent = remaining;

      if (remaining <= 3) {
        hostWordCountdown.className = "big-countdown danger";
        playSound("danger");
      } else if (remaining <= 5) {
        hostWordCountdown.className = "big-countdown warning";
        playSound("warning");
      } else {
        playSound("tickLow");
      }

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        hostWordCountdown.textContent = "🔒";
        hostWordCountdown.className = "big-countdown";
        document.querySelector("#host-word-reveal .phase-title").textContent = "WORDS LOCKED";
        document.querySelector("#host-word-reveal .reveal-instruction").textContent = "Waiting for moderator to start clue circle...";
        playSound("timeUp");
      }
    }, 1000);
  }

  function handleClueCircle(data) {
    showHostScreen("clue-circle");
    const order = data.order;
    let currentIndex = data.currentIndex;
    const clueTime = data.clueTime;

    // Show current speaker
    if (order[currentIndex]) {
      speakerName.textContent = order[currentIndex].name;
    }
    clueProgress.textContent = `${currentIndex + 1} of ${order.length}`;

    // Build queue display
    updateClueQueue(order, currentIndex);

    // Start clue timer
    startClueTimer(clueTime);

    playSound("nextPlayer");
  }

  function startClueTimer(duration) {
    let remaining = duration;
    clueTimerNumber.textContent = remaining;
    clueTimerFill.style.width = "100%";

    if (clueTimerInterval) clearInterval(clueTimerInterval);

    clueTimerInterval = setInterval(() => {
      remaining--;
      clueTimerNumber.textContent = remaining;
      clueTimerFill.style.width = `${(remaining / duration) * 100}%`;

      if (remaining <= 2) {
        playSound("warning");
      }

      if (remaining <= 0) {
        clearInterval(clueTimerInterval);
        playSound("timeUp");
      }
    }, 1000);
  }

  function updateClueQueue(order, currentIndex) {
    upNextQueue.innerHTML = "";
    order.forEach((p, i) => {
      const chip = document.createElement("div");
      chip.className = "queue-chip";
      if (i < currentIndex) chip.classList.add("done");
      if (i === currentIndex) chip.classList.add("current");
      chip.textContent = p.name;
      upNextQueue.appendChild(chip);
    });
  }

  // Next clue player event
  socket.on("clue-next", (data) => {
    if (data.done) {
      // Clue circle complete
      clueTimerNumber.textContent = "✓";
      clueTimerFill.style.width = "0%";
      speakerName.textContent = "CLUE CIRCLE COMPLETE";
      document.querySelector("#host-clue-circle .speaker-label").textContent = "";
      playSound("reveal");
      return;
    }

    if (data.player) {
      speakerName.textContent = data.player.name;
      document.querySelector("#host-clue-circle .speaker-label").textContent = "YOUR TURN";
    }
    clueProgress.textContent = `${data.currentIndex + 1} of ${gameState.clueOrder.length}`;

    // Update queue
    if (gameState && gameState.clueOrder) {
      updateClueQueue(gameState.clueOrder, data.currentIndex);
    }

    // Restart timer
    startClueTimer(data.clueTime);
    playSound("nextPlayer");
  });

  function handleDiscussion(data) {
    showHostScreen("discussion");

    let remaining = data.duration;
    discussionTimer.textContent = formatTime(remaining);
    discussionTimer.className = "discussion-timer";

    discussionInterval = setInterval(() => {
      remaining--;
      discussionTimer.textContent = formatTime(remaining);

      if (remaining <= 30) {
        discussionTimer.className = "discussion-timer low";
      }

      if (remaining <= 10) {
        playSound("warning");
      }

      if (remaining <= 0) {
        clearInterval(discussionInterval);
        playSound("timeUp");
      }
    }, 1000);
  }

  function handleVoting(data) {
    showHostScreen("voting");
    hostVoteProgress.textContent = "0 / " + (gameState ? gameState.aliveCount : "?");
    playSound("suspense");
  }

  // Vote progress update
  socket.on("vote-update", (data) => {
    hostVoteProgress.textContent = `${data.votedCount} / ${data.totalAlive}`;
    playSound("tickLow");
  });

  function handleResults(data) {
    showHostScreen("results");
    voteBars.innerHTML = "";

    const maxVotes = Math.max(...data.voteTally.map((p) => p.votes), 1);
    const eliminateIds = data.toEliminate.map((p) => p.id);
    const tieIds = data.tieBreakerCandidates.map((p) => p.id);

    playSound("drumroll");

    data.voteTally.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "vote-bar-row";
      row.style.animationDelay = `${i * 0.15}s`;

      const isTop = eliminateIds.includes(p.id);
      const isTie = tieIds.includes(p.id);
      const pct = maxVotes > 0 ? (p.votes / maxVotes) * 100 : 0;

      let fillClass = "normal";
      if (isTop) fillClass = "top";
      if (isTie) fillClass = "tie";

      row.innerHTML = `
        <div class="vote-bar-name">${p.name}</div>
        <div class="vote-bar-track">
          <div class="vote-bar-fill ${fillClass}" style="width: 0%">
            <span class="vote-bar-count">${p.votes}</span>
          </div>
        </div>
      `;
      voteBars.appendChild(row);

      // Animate bar width
      setTimeout(() => {
        row.querySelector(".vote-bar-fill").style.width = `${Math.max(pct, 8)}%`;
      }, i * 150 + 300);
    });

    // Show tie break notice if needed
    if (data.needsTieBreak) {
      setTimeout(() => {
        const notice = document.createElement("div");
        notice.style.cssText =
          "text-align:center; margin-top:20px; font-family:var(--font-display); font-size:1.2rem; color:var(--accent-yellow); animation: pulse 1s infinite;";
        notice.textContent = `⚡ TIE DETECTED — ${data.tieBreakerCandidates.map((p) => p.name).join(" vs ")} ⚡`;
        voteBars.appendChild(notice);
      }, data.voteTally.length * 150 + 500);
    }
  }

  function handleTieBreak(data) {
    showHostScreen("tiebreak");
    tiebreakTitle.textContent = "TIE BREAKER!";
    tiebreakResult.textContent = "";
    tiebreakWheel.innerHTML = "";

    const candidates = data.candidates;
    const eliminated = data.eliminated;

    playSound("spinWheel");

    // Create wheel segments
    const segmentAngle = 360 / candidates.length;
    const colors = ["#ff3366", "#00ffff", "#ffcc00", "#aa55ff", "#00ff88", "#ff8800"];

    candidates.forEach((p, i) => {
      const segment = document.createElement("div");
      segment.className = "wheel-segment";
      segment.style.transform = `rotate(${i * segmentAngle}deg)`;
      segment.style.background = `conic-gradient(from ${-segmentAngle / 2}deg, ${colors[i % colors.length]}44 0deg, ${colors[i % colors.length]}22 ${segmentAngle}deg, transparent ${segmentAngle}deg)`;

      const nameEl = document.createElement("span");
      nameEl.className = "segment-name";
      nameEl.textContent = p.name;
      nameEl.style.transform = `rotate(${segmentAngle / 2}deg) translateY(-100px)`;
      segment.appendChild(nameEl);

      tiebreakWheel.appendChild(segment);
    });

    // Spin animation
    const eliminatedIndex = candidates.findIndex((c) => c.id === eliminated[0].id);
    const targetAngle = 360 * 5 + eliminatedIndex * segmentAngle + segmentAngle / 2;

    tiebreakWheel.style.transition = "none";
    tiebreakWheel.style.transform = "rotate(0deg)";

    setTimeout(() => {
      tiebreakWheel.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
      tiebreakWheel.style.transform = `rotate(${targetAngle}deg)`;
    }, 100);

    // Show result after spin
    setTimeout(() => {
      tiebreakResult.textContent = `${eliminated[0].name} ELIMINATED`;
      tiebreakResult.style.animation = "fadeIn 0.5s ease";
      playSound("imposterReveal");
    }, 4500);
  }

  function handleElimination(data) {
    showHostScreen("elimination");
    eliminationCards.innerHTML = "";

    revealMainWord.textContent = data.mainWord;
    revealImposterWord.textContent = data.imposterWord;
    elimRemaining.textContent = data.remainingPlayers;

    // Reveal eliminated players one by one with delay
    data.eliminated.forEach((p, i) => {
      setTimeout(() => {
        const card = document.createElement("div");
        card.className = `elimination-card ${p.wasImposter ? "imposter" : "innocent"}`;
        card.innerHTML = `
          <div class="elim-name">${p.name}</div>
          <div class="elim-role badge ${p.wasImposter ? "badge-imposter" : "badge-innocent"}">
            ${p.wasImposter ? "IMPOSTER" : "INNOCENT"}
          </div>
        `;
        eliminationCards.appendChild(card);

        playSound(p.wasImposter ? "imposterReveal" : "innocentReveal");
      }, i * 2000);
    });

    // Check for game over
    if (data.gameOver) {
      setTimeout(() => {
        handleGameOver(data.gameOver);
      }, data.eliminated.length * 2000 + 2000);
    }
  }

  socket.on("game-over", (data) => {
    // This will also be handled through the elimination phase-change
  });

  function handleGameOver(data) {
    showHostScreen("gameover");

    if (data.winner === "MAIN_TEAM") {
      gameoverTitle.textContent = "MAIN TEAM WINS!";
      gameoverTitle.className = "gameover-title main-wins";
      playSound("victory");
    } else {
      gameoverTitle.textContent = "IMPOSTER WINS!";
      gameoverTitle.className = "gameover-title imposter-wins";
      playSound("defeat");
    }

    gameoverMessage.textContent = data.message;

    gameoverSurvivors.innerHTML = "";
    data.survivors.forEach((p) => {
      const chip = document.createElement("div");
      chip.className = "survivor-chip";
      chip.textContent = p.name;
      gameoverSurvivors.appendChild(chip);
    });
  }

  // ---- Game Restart ----

  socket.on("game-restart", () => {
    clearAllTimers();
    // Reset to lobby — the game-state event will repopulate it
    showHostScreen("lobby");
    hostPlayersGrid.innerHTML = "";
    scoreboardPanel.classList.remove("open");
    playSound("reveal");
  });

  // ---- Utility ----

  function clearAllTimers() {
    if (countdownInterval) clearInterval(countdownInterval);
    if (clueTimerInterval) clearInterval(clueTimerInterval);
    if (discussionInterval) clearInterval(discussionInterval);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ---- Auto-join as host when game is available ----

  // Listen for any game state broadcast (host joins via URL with game ID or auto-discovery)
  // The moderator will tell us which game to join

  // Check URL for game ID
  const urlParams = new URLSearchParams(window.location.search);
  const gameIdParam = urlParams.get("game");

  if (gameIdParam) {
    socket.emit("join-host", { gameId: gameIdParam.toUpperCase() });
  }

  // Also listen for game creation broadcast
  socket.on("connect", () => {
    // If we have a stored game ID, try to rejoin
    if (currentGameId) {
      socket.emit("join-host", { gameId: currentGameId });
    }
  });

  // Expose join function for moderator to call
  window.joinHostGame = function (gameId) {
    currentGameId = gameId;
    socket.emit("join-host", { gameId });
  };

  // Make it accessible via console for easy setup
  window.hostSocket = socket;
})();
