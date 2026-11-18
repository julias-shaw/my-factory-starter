# Tetris-002 Plan

Seed: build a terminal Tetris that starts with `npm start`, keeps the whole
display (board, score, controls, borders, game-over messages) within 24
terminal rows, and may use packages for rendering/input.

1. [x] Initialize an npm project with an `npm start` script and a clear entry file.
2. [x] Render the full layout — bordered board, score, and controls — inside 24 rows.
3. Add the seven tetrominoes, random piece generation, and active-piece rendering.
4. Add left/right movement and rotation with collision checks and wall kicks.
5. Add gravity, soft drop, hard drop, and piece locking.
6. Add completed-line clearing and scoring, shown live in the layout.
7. Add game-over detection with a message and restart, plus pause/quit.
8. Restore terminal state (input mode, cursor) on exit or interruption.
9. Verify `npm start` and confirm the display stays within 24 rows.
