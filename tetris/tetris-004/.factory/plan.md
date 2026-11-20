# Plan

- [x] Set up a terminal application that starts with `npm start` and handles raw keyboard input and clean exit.
  - [x] Validator: arrow escape sequences split across data chunks were parsed per chunk (e.g. `\u001b[` + `D` → `right`). Fixed with a stateful parser (`createKeyParser`) that buffers incomplete escape prefixes between data events; tests cover every split point.
  - [x] Validator: modified arrow `\u001b[1;5D` produced `right` because only `\u001b[1` was consumed and the trailing `D` was read as a letter. Fixed: `splitKeys` now scans complete CSI (parameter/intermediate bytes through a final byte) and SS3 sequences, buffering incomplete ones across chunks; unknown/modified sequences map to no action. Tests cover modified arrows, function keys, mouse/DA replies at every split point.
- [x] Implement core Tetris gameplay: piece spawning, movement, rotation, gravity, locking, line clearing, scoring, and game over.
- [x] Render the board, borders, score, controls, and game-over state within 24 terminal rows.
- [x] Verify game mechanics and display sizing, then test startup and interactive controls with `npm start`.
  - [x] Validator: verification had no recorded results. Verified and recorded:
    - Mechanics: `npm test` passes 36/36, covering spawn/7-bag, wall and block collisions, rotation with wall kicks, gravity, locking, soft/hard drop scoring, line clearing with row shift, level-scaled line scores, level-up speed, game over, pause, and restart.
    - Display size: render tests assert that the playing, paused, and game-over screens fit within 24 rows. A live run in a 24x80 pty drew 22 rows with no scrolling in every state, including game over.
    - Startup: `npm start` in a 24x80 pty enters the alternate screen and shows the board, border, score/lines/level, next piece, controls, and status.
    - Interactive controls (keys sent through the pty): ←×3 moved left, ↑ rotated, →×2 moved right, ↓×3 soft-dropped (score 3), Space hard-dropped and locked (score 25), `p` paused (PAUSED overlay) and resumed, repeated Space reached GAME OVER (score, restart and quit hints shown), `r` restarted (score 0), and `q` exited with status 0 after restoring the cursor and leaving the alternate screen.
