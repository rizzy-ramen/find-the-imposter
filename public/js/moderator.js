/**
 * Moderator Control Panel
 * Handles game creation, phase advancement, settings, and player management.
 */

(function () {
  "use strict";

  const socket = io();

  // State
  let gameId = null;
  let gameState = null;

  // Elements
  const modCreate = document.getElementById("mod-create");
  const modControls = document.getElementById("mod-controls");
  const btnCreateGame = document.getElementById("btn-create-game");
  const modRoomCode = document.getElementById("mod-room-code");
  const modPhase = document.getElementById("mod-phase");
  const modRound = document.getElementById("mod-round");
  const modCount = document.getElementById("mod-count");
  const phaseControls = document.getElementById("phase-controls");
  const modPlayersList = document.getElementById("mod-players-list");
  const hostDisplayLink = document.getElementById("host-display-link");
  const btnCopyHostLink = document.getElementById("btn-copy-host-link");
  const hostLinkSection = document.getElementById("host-link-section");
  const wordInfoSection = document.getElementById("word-info-section");
  const modMainWord = document.getElementById("mod-main-word");
  const modImposterWord = document.getElementById("mod-imposter-word");

  // Settings elements
  const settingWordTime = document.getElementById("setting-word-time");
  const settingClueTime = document.getElementById("setting-clue-time");
  const settingDiscussionTime = document.getElementById("setting-discussion-time");
  const settingVotingTime = document.getElementById("setting-voting-time");
  const btnSaveSettings = document.getElementById("btn-save-settings");

  // ---- Create Game ----

  btnCreateGame.addEventListener("click", () => {
    btnCreateGame.disabled = true;
    btnCreateGame.textContent = "CREATING...";

    socket.emit("create-game", (response) => {
      if (response.success) {
        gameId = response.gameId;
        modRoomCode.textContent = gameId;

        // Build host display link
        const baseUrl = window.location.origin;
        const hostUrl = `${baseUrl}/host?game=${gameId}`;
        hostDisplayLink.href = hostUrl;
        hostDisplayLink.textContent = hostUrl;

        // Switch to controls view
        modCreate.classList.remove("active");
        modControls.classList.add("active");
      } else {
        btnCreateGame.disabled = false;
        btnCreateGame.textContent = "CREATE GAME";
        alert("Failed to create game");
      }
    });
  });

  // ---- Copy Host Link ----

  btnCopyHostLink.addEventListener("click", () => {
    const url = hostDisplayLink.href;
    navigator.clipboard.writeText(url).then(() => {
      btnCopyHostLink.textContent = "COPIED!";
      setTimeout(() => (btnCopyHostLink.textContent = "COPY LINK"), 2000);
    });
  });

  // ---- Save Settings ----

  btnSaveSettings.addEventListener("click", () => {
    if (!gameId) return;

    const settings = {
      wordRevealTime: parseInt(settingWordTime.value) || 10,
      clueTimePerPlayer: parseInt(settingClueTime.value) || 5,
      discussionTime: parseInt(settingDiscussionTime.value) || 180,
      votingTime: parseInt(settingVotingTime.value) || 120,
    };

    socket.emit("update-settings", { gameId, settings });
    btnSaveSettings.textContent = "SAVED!";
    setTimeout(() => (btnSaveSettings.textContent = "SAVE SETTINGS"), 1500);
  });

  // ---- Game State Updates ----

  socket.on("game-state", (state) => {
    gameState = state;
    gameId = state.id;

    // Update status bar
    modPhase.textContent = state.phase;
    modRound.textContent = state.round > 0 ? `Round ${state.round}` : "Not started";
    modCount.textContent = `${state.aliveCount} / ${state.totalPlayers} alive`;

    // Update settings from server
    if (state.settings) {
      settingWordTime.value = state.settings.wordRevealTime;
      settingClueTime.value = state.settings.clueTimePerPlayer;
      settingDiscussionTime.value = state.settings.discussionTime;
      settingVotingTime.value = state.settings.votingTime;
    }

    // Update word info
    if (state.currentWordPair && state.phase !== "LOBBY") {
      wordInfoSection.classList.remove("hidden");
      modMainWord.textContent = state.currentWordPair.mainWord;
      modImposterWord.textContent = state.currentWordPair.imposterWord;
    } else {
      wordInfoSection.classList.add("hidden");
    }

    // Update players list
    updatePlayersList(state.players);

    // Update phase controls
    updatePhaseControls(state.phase);
  });

  // ---- Players List ----

  function updatePlayersList(players) {
    modPlayersList.innerHTML = "";
    if (!players) return;

    players.forEach((p) => {
      const row = document.createElement("div");
      row.className = `player-row-mod ${p.isImposter ? "imposter-row" : ""}`;

      const nameClass = p.isAlive ? "player-name-mod" : "player-name-mod dead";
      const badges = [];
      if (!p.isAlive) badges.push('<span class="badge badge-eliminated">OUT</span>');
      if (!p.connected && p.isAlive) badges.push('<span class="badge badge-disconnected">DC</span>');
      if (p.isImposter && p.isAlive) badges.push('<span class="badge badge-imposter">IMP</span>');

      row.innerHTML = `
        <div class="player-info">
          <span class="${nameClass}">${p.name}</span>
          ${badges.join(" ")}
          ${p.word ? `<span class="player-word">(${p.word})</span>` : ""}
          ${p.hasVoted ? '<span style="color:var(--accent-green); font-size:0.75rem;">✓ voted</span>' : ""}
        </div>
        ${p.isAlive ? `<button class="kick-btn" data-player-id="${p.id}">KICK</button>` : ""}
      `;

      // Add kick handler
      const kickBtn = row.querySelector(".kick-btn");
      if (kickBtn) {
        kickBtn.addEventListener("click", () => {
          if (confirm(`Kick ${p.name} from the game?`)) {
            socket.emit("kick-player", { gameId, playerId: p.id });
          }
        });
      }

      modPlayersList.appendChild(row);
    });
  }

  // ---- Phase Controls ----

  function updatePhaseControls(phase) {
    phaseControls.innerHTML = "";

    switch (phase) {
      case "LOBBY":
        addButton("START ROUND 1", "btn-success current-action", () => {
          if (gameState.totalPlayers < 3) {
            alert("Need at least 3 players to start!");
            return;
          }
          socket.emit("start-round", { gameId });
        });
        break;

      case "WORD_REVEAL":
        addButton("START CLUE CIRCLE", "btn-purple current-action", () => {
          socket.emit("start-clue-circle", { gameId });
        });
        addButton("SKIP TO DISCUSSION", "btn-warning", () => {
          socket.emit("start-discussion", { gameId });
        });
        break;

      case "CLUE_CIRCLE":
        addButton("NEXT PLAYER", "btn-primary current-action", () => {
          socket.emit("next-clue-player", { gameId });
        });
        addButton("SKIP TO DISCUSSION", "btn-warning", () => {
          socket.emit("start-discussion", { gameId });
        });
        break;

      case "DISCUSSION":
        addButton("OPEN VOTING", "btn-danger current-action", () => {
          socket.emit("start-voting", { gameId });
        });
        break;

      case "VOTING":
        addButton("CLOSE VOTING & SHOW RESULTS", "btn-danger current-action", () => {
          socket.emit("close-voting", { gameId });
        });
        break;

      case "RESULTS":
        if (gameState && gameState.phase === "RESULTS") {
          // Check if tie break is needed - we'll know from the UI state
          addButton("RESOLVE TIE BREAK", "btn-warning", () => {
            socket.emit("resolve-tiebreak", { gameId });
          });
        }
        addButton("REVEAL ELIMINATIONS", "btn-danger current-action", () => {
          socket.emit("execute-eliminations", { gameId });
        });
        break;

      case "TIE_BREAK":
        addButton("REVEAL ELIMINATIONS", "btn-danger current-action", () => {
          socket.emit("execute-eliminations", { gameId });
        });
        break;

      case "ELIMINATION":
        if (gameState && gameState.aliveCount > 2) {
          addButton(
            `START ROUND ${gameState.round + 1}`,
            "btn-success current-action",
            () => {
              socket.emit("start-round", { gameId });
            }
          );
        }
        break;

      case "GAME_OVER":
        addButton("RESTART GAME", "btn-success current-action", () => {
          if (confirm("Restart with the same players and room code?")) {
            socket.emit("restart-game", { gameId });
          }
        });
        addButton("NEW GAME (NEW ROOM)", "btn-primary", () => {
          window.location.reload();
        });
        break;
    }

    // Add restart option to every non-lobby phase
    if (phase !== "LOBBY" && phase !== "GAME_OVER") {
      addSeparator();
      addButton("RESTART GAME", "btn-small btn-danger", () => {
        if (confirm("Abort the current game and restart with the same players?")) {
          socket.emit("restart-game", { gameId });
        }
      });
    }
  }

  function addButton(text, classes, onClick) {
    const btn = document.createElement("button");
    btn.className = `btn ${classes}`;
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    phaseControls.appendChild(btn);
  }

  function addSeparator() {
    const hr = document.createElement("hr");
    hr.style.cssText = "border:none; border-top:1px solid var(--border-color); margin:8px 0;";
    phaseControls.appendChild(hr);
  }

  // ---- Handle Game Restart ----

  socket.on("game-restart", () => {
    // State will be refreshed via game-state event automatically
  });
})();
