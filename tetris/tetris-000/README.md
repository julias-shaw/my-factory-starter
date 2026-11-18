# Terminal Tetris

Requires Node.js 18 or newer. No dependencies to install.

```sh
npm start
```

Use an interactive terminal at least **70 columns × 24 rows**. The entire game,
including status and controls, occupies 24 rows. Redirected/non-interactive
output prints a single board and exits.

| Key | Action |
| --- | --- |
| Left / Right arrow | Move |
| Up arrow | Rotate clockwise (with wall adjustments) |
| Down arrow | Soft drop one row; lock if blocked |
| Space | Hard drop and lock |
| P | Pause / resume |
| R | Restart with an empty board and zero score (also after game over) |
| Q / Ctrl+C | Quit |

Pieces fall automatically every 700 ms. Completing 1, 2, 3, or 4 rows at once
awards 100, 300, 500, or 800 points respectively. The game ends when the next
piece cannot spawn. Quitting restores the cursor and the previous terminal screen.

Run the automated core-rule and display tests with:

```sh
npm test
```
