# Terminal Tetris Plan

- [x] Set up the npm project and a terminal-based game loop, input handling, and rendering.
  - [x] Validator: keep incomplete escape sequences split across terminal data events so a split arrow (e.g. `\u001b[` then `D`) maps to the right action; test it.
  - [x] Validator: `src/index.js` calls `run()` on import; guard it so it only runs when executed directly, verify import has no terminal/process side effects and `npm start` still launches.
  - [x] Validator: `shutdown()` leaves SIGINT/SIGTERM/uncaughtException listeners registered; remove them on shutdown (named exception handler) and add a focused cleanup test.
- [x] Implement Tetris gameplay: the seven tetrominoes, movement, rotation, gravity, line clears, scoring, and game over/restart.
- [ ] Keep the full board, borders, score, controls, and status messages within 24 terminal rows.
- [ ] Validate `npm start` and core gameplay, including terminal sizing and game-over behavior.
