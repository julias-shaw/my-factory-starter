# Tetris Implementation Plan

- [x] Set up the Node.js project and a terminal entry point so `npm start` launches the game.
- [x] Implement the Tetris game state: seven tetrominoes, rotation, movement, gravity, collision detection, line clearing, scoring, spawn/game-over logic, and restart/quit controls.
- [x] Build the terminal renderer and keyboard handling, keeping the entire board, borders, score, controls, and messages within 24 rows.
  - [x] Validator: prevent noninteractive output from hiding the terminal cursor and verify both stdin modes in a PTY.
- [x] Add focused tests for core mechanics and rendering dimensions, then run the tests and manually verify startup, controls, line clearing, game over, restart, and the 24-row limit.
