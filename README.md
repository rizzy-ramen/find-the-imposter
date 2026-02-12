# Find The Imposter

A 30-player social deduction game with real-time web interface. Players receive secret words, give clues, and vote to eliminate imposters.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server will display your local IP. You'll see output like:

```
🎭 FIND THE IMPOSTER - Server Running!

   Local:   http://localhost:3000
   Network: http://192.168.1.42:3000

   Host Display:       http://192.168.1.42:3000/host
   Moderator Controls: http://192.168.1.42:3000/moderator
   Player Join:        http://192.168.1.42:3000/play
```

## How To Run The Game

### Setup (Moderator)

1. Run `npm start` on your laptop
2. Open **Tab 1**: `http://localhost:3000/moderator` — your control panel (DO NOT share this via Zoom)
3. Click **CREATE GAME** to get a room code
4. Copy the host display link shown on the moderator panel
5. Open **Tab 2**: the host display link (e.g., `http://localhost:3000/host?game=ABCD`) — share THIS tab via Zoom
6. Players will see the room code and QR code on the projected screen

### For Players

1. Open your browser and go to `http://<moderator-ip>:3000/play`
2. Enter the 4-letter room code shown on the meeting room screen
3. Enter your name
4. Click JOIN

### Game Flow

The moderator controls each phase by clicking buttons on the moderator panel:

1. **START ROUND** — Assigns words to all players
2. Players see their word for 10 seconds (configurable), then it disappears
3. **START CLUE CIRCLE** — Shows each player's name on screen with a timer
4. **NEXT PLAYER** — Advances to next player in the clue circle
5. **SKIP TO DISCUSSION** — Opens free discussion period
6. **OPEN VOTING** — Players vote on their devices
7. **CLOSE VOTING** — Tallies votes and shows results
8. **RESOLVE TIE BREAK** — If there's a tie, spins the wheel
9. **REVEAL ELIMINATIONS** — Shows who was eliminated and their role
10. **START NEXT ROUND** — Begins the next round

### Final Round (3 players)

- 1 imposter among the final 3
- Vote eliminates 1 player
- If the imposter was caught → **Main Team Wins!**
- If the imposter survived → **Imposter Wins!**

## Settings

Configurable via the moderator panel before or between rounds:

| Setting | Default | Description |
|---------|---------|-------------|
| Word reveal time | 10s | How long the word stays on screen |
| Clue time per player | 5s | Seconds per player in clue circle |
| Discussion time | 180s | Open discussion duration |
| Voting time | 120s | Time to cast votes |

## Elimination Plan

| Round | Imposters | Eliminated | Remaining |
|-------|-----------|------------|-----------|
| 1 | 4 | 4 | 26 |
| 2 | 4 | 4 | 22 |
| 3 | 3 | 3 | 19 |
| 4 | 3 | 3 | 16 |
| 5 | 3 | 3 | 13 |
| 6 | 2 | 2 | 11 |
| 7 | 2 | 2 | 9 |
| 8 | 2 | 2 | 7 |
| 9 | 1 | 1 | 6 |
| ... | 1 | 1 | ... |
| Final | 1 | 1 | 2 (winners) |

## Word Difficulty Progression

- **Rounds 1–3** (Easy): Coffee/Juice, Dog/Cat, etc.
- **Rounds 4–6** (Medium): Eagle/Hawk, Piano/Keyboard, etc.
- **Rounds 7–9** (Hard): Butter/Margarine, Alligator/Crocodile, etc.
- **Round 10+** (Evil): Fog/Mist, Turtle/Tortoise, etc.

## Tech Stack

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Real-time**: WebSocket via Socket.IO
- **QR Codes**: Generated server-side via `qrcode` library
- **Sound Effects**: Web Audio API (no external files needed)

## Project Structure

```
find-the-imposter/
├── package.json
├── README.md
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── game.js           # Game state machine & logic
│   └── words.js          # Word pairs by difficulty
└── public/
    ├── player.html       # Player interface
    ├── host.html         # Projected host display
    ├── moderator.html    # Moderator controls
    ├── css/
    │   ├── common.css    # Shared styles & theme
    │   ├── player.css    # Player view styles
    │   ├── host.css      # Host display styles
    │   └── moderator.css # Moderator panel styles
    └── js/
        ├── player.js     # Player client logic
        ├── host.js       # Host display logic
        └── moderator.js  # Moderator client logic
```
