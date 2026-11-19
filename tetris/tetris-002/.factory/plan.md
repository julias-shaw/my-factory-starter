# Tetris-002 Plan

Seed: build a terminal Tetris that starts with `npm start`, keeps the whole
display (board, score, controls, borders, game-over messages) within 24
terminal rows, and may use packages for rendering/input.

1. [x] Initialize an npm project with an `npm start` script and a clear entry file.
2. [x] Render the full layout — bordered board, score, and controls — inside 24 rows.
3. [x] Add the seven tetrominoes, random piece generation, and active-piece rendering.
   3.1 Export createBoard, createPiece, and renderBoard so tests can drive piece logic without the CLI.
   3.2 Make createPiece accept an injectable RNG so random generation tests are deterministic.
   3.3 Separate tetromino shape matrices from ANSI color strings.
   3.4 Update footer text to accurately describe the active-piece rendering.
   3.5 Trim controls panel to only advertise actions wired in this task.
   3.6 Make renderBoard return the rendered board as a string array instead of writing directly to process.stdout.
   3.7 Fix awkward line split of "Active piece" / "rendered." in the status panel.
   3.8 Ensure the controls panel does not advertise move, rotate, drop, pause, or quit as coming next.
4. [x] Add left/right movement and rotation with collision checks and wall kicks.
5. Add gravity, soft drop, hard drop, and piece locking.
6. Add completed-line clearing and scoring, shown live in the layout.
7. Add game-over detection with a message and restart, plus pause/quit.
8. Restore terminal state (input mode, cursor) on exit or interruption.
9. Verify `npm start` and confirm the display stays within 24 rows.
