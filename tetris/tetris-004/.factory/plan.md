# Plan

- [x] Set up a terminal application that starts with `npm start` and handles raw keyboard input and clean exit.
  - [x] Validator: arrow escape sequences split across data chunks were parsed per chunk (e.g. `\u001b[` + `D` → `right`). Fixed with a stateful parser (`createKeyParser`) that buffers incomplete escape prefixes between data events; tests cover every split point.
  - [x] Validator: modified arrow `\u001b[1;5D` produced `right` because only `\u001b[1` was consumed and the trailing `D` was read as a letter. Fixed: `splitKeys` now scans complete CSI (parameter/intermediate bytes through a final byte) and SS3 sequences, buffering incomplete ones across chunks; unknown/modified sequences map to no action. Tests cover modified arrows, function keys, mouse/DA replies at every split point.
- [x] Implement core Tetris gameplay: piece spawning, movement, rotation, gravity, locking, line clearing, scoring, and game over.
- [x] Render the board, borders, score, controls, and game-over state within 24 terminal rows.
- [ ] Verify game mechanics and display sizing, then test startup and interactive controls with `npm start`.
