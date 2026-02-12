/**
 * Player client - handles join, word reveal, voting, and game state.
 */

(function () {
  "use strict";

  const socket = io();

  // State
  let playerId = localStorage.getItem("playerId");
  let gameId = localStorage.getItem("gameId");
  let playerName = localStorage.getItem("playerName");
  let selectedVote = null;
  let isEliminated = false;
  let wordTimer = null;
  let voteTimer = null;

  // Elements
  const screens = document.querySelectorAll(".screen");
  const inputRoomCode = document.getElementById("input-room-code");
  const inputPlayerName = document.getElementById("input-player-name");
  const btnJoin = document.getElementById("btn-join");
  const joinError = document.getElementById("join-error");
  const lobbyPlayerCount = document.getElementById("lobby-player-count");
  const lobbyYourName = document.getElementById("lobby-your-name");
  const wordDisplay = document.getElementById("word-display");
  const wordTimerNumber = document.getElementById("word-timer-number");
  const wordRingProgress = document.getElementById("word-ring-progress");
  const waitingPhaseLabel = document.getElementById("waiting-phase-label");
  const waitingPhaseInfo = document.getElementById("waiting-phase-info");
  const voteList = document.getElementById("vote-list");
  const voteConfirmBar = document.getElementById("vote-confirm-bar");
  const btnConfirmVote = document.getElementById("btn-confirm-vote");
  const voteTimerDisplay = document.getElementById("vote-timer-display");
  const resultMessage = document.getElementById("result-message");
  const resultRemaining = document.getElementById("result-remaining");
  const eliminatedRole = document.getElementById("eliminated-role");

  // ---- Screen Management ----

  function showScreen(id) {
    screens.forEach((s) => s.classList.remove("active"));
    const screen = document.getElementById(`screen-${id}`);
    if (screen) screen.classList.add("active");
  }

  // ---- Pre-fill room code from URL ----
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("room")) {
    inputRoomCode.value = urlParams.get("room");
  }

  // ---- Join Game ----

  btnJoin.addEventListener("click", joinGame);
  inputPlayerName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") joinGame();
  });
  inputRoomCode.addEventListener("keypress", (e) => {
    if (e.key === "Enter") inputPlayerName.focus();
  });

  // Auto-uppercase room code
  inputRoomCode.addEventListener("input", () => {
    inputRoomCode.value = inputRoomCode.value.toUpperCase();
  });

  function joinGame() {
    const roomCode = inputRoomCode.value.trim().toUpperCase();
    const name = inputPlayerName.value.trim();

    if (!roomCode || roomCode.length !== 4) {
      joinError.textContent = "Enter a 4-letter room code";
      return;
    }
    if (!name) {
      joinError.textContent = "Enter your name";
      return;
    }

    joinError.textContent = "";
    btnJoin.disabled = true;
    btnJoin.textContent = "JOINING...";

    socket.emit(
      "join-game",
      { gameId: roomCode, playerName: name, playerId },
      (response) => {
        btnJoin.disabled = false;
        btnJoin.textContent = "JOIN GAME";

        if (response.success) {
          playerId = response.playerId;
          gameId = response.gameId;
          playerName = name;

          localStorage.setItem("playerId", playerId);
          localStorage.setItem("gameId", gameId);
          localStorage.setItem("playerName", playerName);

          // Determine which screen to show based on current game state
          handlePlayerState(response.playerState);
        } else {
          joinError.textContent = response.error;
        }
      }
    );
  }

  // ---- Attempt Reconnection ----

  if (playerId && gameId && playerName) {
    socket.emit(
      "join-game",
      { gameId, playerName, playerId },
      (response) => {
        if (response.success && response.reconnected) {
          handlePlayerState(response.playerState);
        }
        // If reconnection fails, stay on join screen
      }
    );
  }

  // ---- Handle Game State ----

  function handlePlayerState(state) {
    if (!state) return;

    if (!state.you.isAlive) {
      showScreen("eliminated");
      isEliminated = true;
      return;
    }

    switch (state.phase) {
      case "LOBBY":
        showScreen("lobby");
        lobbyPlayerCount.textContent = state.totalPlayers;
        lobbyYourName.textContent = state.you.name;
        break;

      case "WORD_REVEAL":
        // Word already shown and gone — show word gone screen
        showScreen("word-gone");
        break;

      case "CLUE_CIRCLE":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "CLUE CIRCLE IN PROGRESS";
        waitingPhaseInfo.textContent = "Listen and observe. Your turn may come soon.";
        break;

      case "DISCUSSION":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "DISCUSSION IN PROGRESS";
        waitingPhaseInfo.textContent = "Debate, question, and defend.";
        break;

      case "VOTING":
        if (state.you.hasVoted) {
          showScreen("vote-submitted");
        } else {
          showScreen("waiting");
          waitingPhaseLabel.textContent = "VOTING PHASE";
          waitingPhaseInfo.textContent = "Waiting for voting to open...";
        }
        break;

      case "RESULTS":
      case "TIE_BREAK":
      case "ELIMINATION":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "RESULTS";
        waitingPhaseInfo.textContent = "Watch the host screen for the results...";
        break;

      case "GAME_OVER":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "GAME OVER";
        waitingPhaseInfo.textContent = "Watch the host screen for the final result!";
        break;

      default:
        showScreen("lobby");
    }
  }

  // ---- Socket Events ----

  socket.on("player-state", handlePlayerState);

  socket.on("game-state", (state) => {
    if (state.phase === "LOBBY") {
      lobbyPlayerCount.textContent = state.totalPlayers;
    }
  });

  // Word reveal
  socket.on("word-reveal", (data) => {
    if (isEliminated) return;

    showScreen("word-reveal");
    wordDisplay.textContent = data.word;
    const duration = data.duration;

    // Show imposter count
    const imposterBadge = document.getElementById("player-imposter-count");
    if (imposterBadge) {
      imposterBadge.textContent = `${data.imposterCount} imposter${data.imposterCount > 1 ? "s" : ""} this round`;
    }
    let remaining = duration;

    const circumference = 2 * Math.PI * 54;
    wordRingProgress.style.strokeDasharray = circumference;
    wordRingProgress.style.strokeDashoffset = 0;
    wordTimerNumber.textContent = remaining;

    // Play countdown sound effect (if available)
    playSound("countdown");

    wordTimer = setInterval(() => {
      remaining--;
      wordTimerNumber.textContent = remaining;

      const offset = circumference * (1 - remaining / duration);
      wordRingProgress.style.strokeDashoffset = offset;

      if (remaining <= 3) {
        wordRingProgress.style.stroke = "var(--accent-red)";
        wordTimerNumber.style.color = "var(--accent-red)";
        playSound("tick");
      }

      if (remaining <= 0) {
        clearInterval(wordTimer);
        // CRITICAL: Remove word from memory and DOM
        wordDisplay.textContent = "";
        wordRingProgress.style.stroke = "var(--accent-cyan)";
        wordTimerNumber.style.color = "var(--accent-cyan)";
        showScreen("word-gone");
        playSound("wordGone");
      }
    }, 1000);
  });

  // Voting open
  socket.on("voting-open", (data) => {
    if (isEliminated) return;

    showScreen("voting");
    playSound("phaseVoting");
    selectedVote = null;
    voteConfirmBar.style.display = "none";
    btnConfirmVote.disabled = false;
    btnConfirmVote.textContent = "CONFIRM VOTE";
    voteList.innerHTML = "";

    data.alivePlayers.forEach((p) => {
      const div = document.createElement("div");
      div.className = "vote-option";
      div.textContent = p.name;
      div.dataset.playerId = p.id;
      div.addEventListener("click", () => selectVote(p.id, div));
      voteList.appendChild(div);
    });

    // Vote timer
    let remaining = data.duration;
    voteTimerDisplay.textContent = formatTime(remaining);

    if (voteTimer) clearInterval(voteTimer);
    voteTimer = setInterval(() => {
      remaining--;
      voteTimerDisplay.textContent = formatTime(remaining);
      if (remaining <= 0) {
        clearInterval(voteTimer);
      }
    }, 1000);
  });

  function selectVote(targetId, element) {
    selectedVote = targetId;
    document.querySelectorAll(".vote-option").forEach((el) => el.classList.remove("selected"));
    element.classList.add("selected");
    voteConfirmBar.style.display = "block";
  }

  btnConfirmVote.addEventListener("click", () => {
    if (!selectedVote) return;

    btnConfirmVote.disabled = true;
    btnConfirmVote.textContent = "SUBMITTING...";

    socket.emit("cast-vote", { gameId, targetId: selectedVote }, (response) => {
      if (response.success) {
        showScreen("vote-submitted");
        playSound("voteSubmit");
      } else {
        btnConfirmVote.disabled = false;
        btnConfirmVote.textContent = "CONFIRM VOTE";
        alert(response.error);
      }
    });
  });

  // Eliminated
  socket.on("you-eliminated", (data) => {
    isEliminated = true;

    if (data.kicked) {
      // Kicked players can rejoin — clear stored session so they join as new player
      localStorage.removeItem("playerId");
      localStorage.removeItem("gameId");
      localStorage.removeItem("playerName");
      playerId = null;

      document.getElementById("eliminated-heading").textContent = "YOU HAVE BEEN REMOVED";
      eliminatedRole.innerHTML =
        'You were removed by the moderator.<br><br>' +
        '<span style="color:var(--accent-cyan); font-size:0.9rem;">Please refresh this page to rejoin the game.</span>';
    } else {
      document.getElementById("eliminated-heading").textContent = "YOU HAVE BEEN ELIMINATED";
      eliminatedRole.textContent = data.wasImposter
        ? `You were the IMPOSTER. Your word was: ${data.word}`
        : `You were INNOCENT. Your word was: ${data.word}`;
    }

    showScreen("eliminated");
    playSound("eliminated");
  });

  // Phase changes that affect player view
  socket.on("phase-change", (data) => {
    if (isEliminated) return;

    switch (data.phase) {
      case "CLUE_CIRCLE":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "CLUE CIRCLE";
        waitingPhaseInfo.textContent = "Listen and observe. Give your clue when called.";
        playSound("phaseClue");
        break;

      case "DISCUSSION":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "OPEN DISCUSSION";
        waitingPhaseInfo.textContent = "Debate, question, and defend yourself.";
        playSound("phaseDiscussion");
        break;

      case "RESULTS":
      case "TIE_BREAK":
        showScreen("waiting");
        waitingPhaseLabel.textContent = "RESULTS";
        waitingPhaseInfo.textContent = "Watch the host screen...";
        playSound("phaseResults");
        break;

      case "ELIMINATION":
        if (!isEliminated) {
          // Still alive after elimination
          if (data.gameOver) {
            showScreen("waiting");
            waitingPhaseLabel.textContent = "GAME OVER";
            waitingPhaseInfo.textContent = "Watch the host screen for the final result!";
            playSound("phaseGameOver");
          } else {
            showScreen("result");
            resultMessage.textContent = "You survived this round!";
            resultRemaining.textContent = `${data.remainingPlayers} players remain.`;
            playSound("survived");
          }
        }
        break;
    }
  });

  // ---- Game Restart ----

  socket.on("game-restart", () => {
    // Reset all local state
    isEliminated = false;
    selectedVote = null;
    if (wordTimer) clearInterval(wordTimer);
    if (voteTimer) clearInterval(voteTimer);
    wordTimer = null;
    voteTimer = null;

    // Reset UI elements
    wordDisplay.textContent = "";
    btnConfirmVote.disabled = false;
    btnConfirmVote.textContent = "CONFIRM VOTE";
    voteConfirmBar.style.display = "none";
    voteList.innerHTML = "";

    // Go back to lobby
    showScreen("lobby");
    lobbyYourName.textContent = playerName;
  });

  // ---- Anti-cheat ----

  // Disable right-click
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Detect dev tools (basic)
  let devToolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        // Blur the word if visible
        if (wordDisplay) wordDisplay.style.filter = "blur(20px)";
      }
    } else {
      devToolsOpen = false;
      if (wordDisplay) wordDisplay.style.filter = "none";
    }
  }, 500);

  // Disable keyboard shortcuts for dev tools
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
      (e.ctrlKey && e.key === "u") ||
      e.key === "F12"
    ) {
      e.preventDefault();
    }
  });

  // ---- Utility ----

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Simple sound effects using Web Audio API
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playSound(type) {
    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      switch (type) {
        case "tick":
          oscillator.frequency.value = 800;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.1);
          break;
        case "countdown":
          oscillator.frequency.value = 440;
          gainNode.gain.value = 0.08;
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.2);
          break;
        case "wordGone":
          oscillator.frequency.value = 200;
          oscillator.type = "sawtooth";
          gainNode.gain.value = 0.1;
          oscillator.start();
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
          oscillator.stop(audioCtx.currentTime + 0.5);
          break;
        case "voteSubmit":
          oscillator.frequency.value = 600;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.15);
          oscillator.stop(audioCtx.currentTime + 0.15);
          break;
        case "eliminated":
          oscillator.frequency.value = 400;
          oscillator.type = "sawtooth";
          gainNode.gain.value = 0.15;
          oscillator.start();
          oscillator.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.8);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
          oscillator.stop(audioCtx.currentTime + 0.8);
          break;
        case "phaseClue":
          // Rising chime — attention, it's clue time
          oscillator.frequency.value = 500;
          oscillator.type = "sine";
          gainNode.gain.value = 0.12;
          oscillator.start();
          oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.15);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
          oscillator.stop(audioCtx.currentTime + 0.4);
          break;
        case "phaseDiscussion": {
          // Double tone — debate is on
          const o2 = audioCtx.createOscillator();
          const g2 = audioCtx.createGain();
          o2.connect(g2);
          g2.connect(audioCtx.destination);
          oscillator.frequency.value = 600;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.12);
          o2.frequency.value = 750;
          g2.gain.value = 0.1;
          o2.start(audioCtx.currentTime + 0.15);
          o2.stop(audioCtx.currentTime + 0.27);
          break;
        }
        case "phaseVoting": {
          // Urgent triple beep — vote now
          [0, 0.15, 0.3].forEach((delay) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.frequency.value = 880;
            o.type = "square";
            g.gain.value = 0.08;
            o.start(audioCtx.currentTime + delay);
            o.stop(audioCtx.currentTime + delay + 0.08);
          });
          break;
        }
        case "phaseResults": {
          // Suspenseful low sweep
          oscillator.frequency.value = 200;
          oscillator.type = "triangle";
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.6);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
          oscillator.stop(audioCtx.currentTime + 0.8);
          break;
        }
        case "phaseGameOver": {
          // Dramatic low drone + high ping
          oscillator.frequency.value = 100;
          oscillator.type = "sawtooth";
          gainNode.gain.value = 0.1;
          oscillator.start();
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
          oscillator.stop(audioCtx.currentTime + 1.0);
          const ping = audioCtx.createOscillator();
          const pg = audioCtx.createGain();
          ping.connect(pg);
          pg.connect(audioCtx.destination);
          ping.frequency.value = 1200;
          pg.gain.value = 0.08;
          ping.start(audioCtx.currentTime + 0.5);
          pg.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
          ping.stop(audioCtx.currentTime + 1.2);
          break;
        }
        case "survived": {
          // Happy rising arpeggio
          [523, 659, 784].forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.frequency.value = freq;
            g.gain.value = 0.08;
            o.start(audioCtx.currentTime + i * 0.12);
            o.stop(audioCtx.currentTime + i * 0.12 + 0.2);
          });
          break;
        }
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  // Resume audio context on first interaction
  document.addEventListener("click", () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
  }, { once: true });
})();
