# Tetris Terminal Game Plan

## Objective
Build a complete Tetris game that runs in the terminal and starts with `npm start`, with the entire display fitting within 24 terminal rows.

## Tasks

1. **Project setup** — **Done**
   - Initialize a Node.js project in the target directory.
   - Add a `start` script in `package.json` that launches the game.
   - Install only necessary terminal rendering/input packages (e.g., `blessed`, `ink`, or raw `readline`/`stdin` if no dependencies are needed).

2. **Game board and rendering** — **Done**
   - Create a fixed-size Tetris playfield (standard 10 columns x 20 rows).
   - Render the board, active piece, borders, score, and controls.
   - Ensure the complete display never exceeds 24 terminal rows.

3. **Tetrominoes and movement** — **Done**
   - Implement all seven Tetromino shapes (I, O, T, S, Z, J, L) with spawn positions and colors.
   - Implement left/right movement, soft drop, hard drop, rotation (clockwise/counter-clockwise), and collision detection.
   - Handle wall kicks for rotation when adjacent to walls or other blocks.

4. **Game mechanics** — **Done**
   - Implement the falling piece loop with a configurable tick interval that speeds up over time.
   - Implement line clearing and scoring (single, double, triple, tetris).
   - Implement game-over detection when a new piece cannot spawn.
   - Implement level progression and display next piece preview.

5. **Controls and UX** — **Done**
   - Map keyboard controls: left, right, rotate, soft drop, hard drop, pause, quit.
   - Show controls/help text within the 24-row budget.
   - Show game-over message and final score; allow restart or quit.

6. **Build and verify** — **Done**
   - Run `npm install` and `npm start` to verify the game launches.
   - Verify display fits 24 rows and all core mechanics work.
