// Application shell: owns app state, routes actions to the game, and builds
// the view (a list of text lines) for the renderer.

import { BOARD_HEIGHT, BOARD_WIDTH, ROTATIONS, createGame, pieceCells } from './game.js';

export { BOARD_HEIGHT, BOARD_WIDTH };

const FILLED = '[]';
const EMPTY = ' .';
const GHOST = '::';

export function createApp({ onQuit = () => {}, random, nextPiece } = {}) {
  const game = createGame({ random, nextPiece });
  const state = {
    paused: false,
    elapsedMs: 0,
    lastAction: null,
    game,
  };

  function handleAction(action) {
    state.lastAction = action;
    if (action === 'quit') {
      onQuit();
      return;
    }
    if (action === 'restart') {
      game.restart();
      state.paused = false;
      state.elapsedMs = 0;
      return;
    }
    if (game.state.gameOver) return;
    if (action === 'pause') {
      state.paused = !state.paused;
      return;
    }
    if (state.paused) return;
    switch (action) {
      case 'left': game.moveLeft(); break;
      case 'right': game.moveRight(); break;
      case 'rotate': game.rotate(1); break;
      case 'softDrop': game.softDrop(); break;
      case 'hardDrop': game.hardDrop(); break;
      default: break;
    }
  }

  function update(dtMs) {
    if (state.paused || game.state.gameOver) return;
    state.elapsedMs += dtMs;
    game.tick(dtMs);
  }

  function boardRows() {
    const g = game.state;
    const grid = g.board.map((row) => row.map((cell) => (cell ? FILLED : EMPTY)));
    if (!g.gameOver) {
      const ghostY = game.ghostY();
      for (const [x, y] of pieceCells({ ...g.current, y: ghostY })) {
        if (y >= 0 && grid[y][x] === EMPTY) grid[y][x] = GHOST;
      }
    }
    for (const [x, y] of pieceCells(g.current)) {
      if (y >= 0) grid[y][x] = FILLED;
    }
    return grid.map((row) => row.join(''));
  }

  function nextPreview() {
    const cells = ROTATIONS[game.state.next][0];
    const rows = [Array(4).fill('  '), Array(4).fill('  ')];
    const minY = Math.min(...cells.map(([, y]) => y));
    for (const [x, y] of cells) rows[y - minY][x] = FILLED;
    return rows.map((r) => r.join(''));
  }

  function statusMessage() {
    if (game.state.gameOver) return 'GAME OVER - press R to restart, Q to quit';
    if (state.paused) return 'PAUSED - press P to resume';
    return '';
  }

  function view() {
    const g = game.state;
    const preview = nextPreview();
    const side = [
      '',
      ' SCORE',
      ` ${g.score}`,
      '',
      ' LINES',
      ` ${g.lines}`,
      '',
      ' LEVEL',
      ` ${g.level}`,
      '',
      ' NEXT',
      ` ${preview[0]}`,
      ` ${preview[1]}`,
      '',
      ` Time ${Math.floor(state.elapsedMs / 1000)}s`,
      '',
      g.gameOver ? ' GAME OVER' : state.paused ? ' PAUSED' : '',
    ];
    const border = '+' + '-'.repeat(BOARD_WIDTH * 2) + '+';
    const rows = [border, ...boardRows().map((r) => `|${r}|`), border];
    const lines = rows.map((row, i) => (side[i] ? `${row}${side[i]}` : row));
    lines.push(statusMessage());
    lines.push('Arrows/WASD move+rotate  Space drop  P pause  R restart  Q quit');
    return lines;
  }

  return { state, handleAction, update, view };
}
