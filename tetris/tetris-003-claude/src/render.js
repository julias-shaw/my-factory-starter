// Terminal renderer: turns game state into lines of text that fit within
// MAX_ROWS terminal rows.

import { pieceCells } from './game.js';

export const MAX_ROWS = 24;

const ESC = '\u001b[';
const RESET = `${ESC}0m`;

// Background colors per piece type (256-color palette falls back fine on 16-color terminals).
const COLORS = {
  I: `${ESC}46m`, // cyan
  O: `${ESC}43m`, // yellow
  T: `${ESC}45m`, // magenta
  S: `${ESC}42m`, // green
  Z: `${ESC}41m`, // red
  J: `${ESC}44m`, // blue
  L: `${ESC}48;5;208m`, // orange
};
const GHOST = `${ESC}2m`;

const CONTROLS = [
  '← →  move',
  '↓    soft drop',
  '↑ x  rotate',
  'z    rotate back',
  'spc  hard drop',
  'p    pause',
  'r    restart',
  'q    quit',
];

// Strip ANSI escape codes to measure visible width.
export function visibleText(line) {
  // eslint-disable-next-line no-control-regex
  return line.replace(/\u001b\[[0-9;]*m/g, '');
}

function cell(type, color, ghost = false) {
  if (ghost) return color ? `${GHOST}[]${RESET}` : '::';
  if (!type) return ' .';
  return color ? `${COLORS[type]}  ${RESET}` : '[]';
}

function boardLines(game, color) {
  const grid = game.board.map((row) => row.slice());
  const ghostCells = new Set();
  if (game.current && !game.gameOver) {
    const ghost = game.ghost();
    if (ghost) for (const [x, y] of pieceCells(ghost)) ghostCells.add(`${x},${y}`);
    for (const [x, y] of pieceCells(game.current)) {
      if (y >= 0 && y < game.height) grid[y][x] = game.current.type;
    }
  }
  const lines = grid.map(
    (row, y) =>
      '│' +
      row.map((type, x) => cell(type, color, !type && ghostCells.has(`${x},${y}`))).join('') +
      '│',
  );
  const inner = game.width * 2;
  lines.unshift('┌' + '─'.repeat(inner) + '┐');
  lines.push('└' + '─'.repeat(inner) + '┘');

  const banner = game.gameOver ? ['GAME OVER', 'r: restart'] : game.paused ? ['PAUSED', 'p: resume'] : null;
  if (banner) {
    const mid = Math.floor(lines.length / 2) - 1;
    banner.forEach((text, i) => {
      const padded = ` ${text} `;
      const left = Math.floor((inner - padded.length) / 2);
      const right = inner - padded.length - left;
      const styled = color ? `${ESC}7m${padded}${RESET}` : padded;
      lines[mid + i] = '│' + ' '.repeat(left) + styled + ' '.repeat(right) + '│';
    });
  }
  return lines;
}

function nextPieceLines(type, color) {
  const cells = pieceCells({ type, rotation: 0, x: 0, y: 0 });
  const rows = [0, 1].map((y) =>
    [0, 1, 2, 3]
      .map((x) => (cells.some(([cx, cy]) => cx === x && cy === y) ? cell(type, color) : '  '))
      .join(''),
  );
  return rows;
}

function panelLines(game, color) {
  const status = game.gameOver ? 'GAME OVER' : game.paused ? 'PAUSED' : '';
  const statusLine = status && color ? `${ESC}1m${status}${RESET}` : status;
  return [
    color ? `${ESC}1mTETRIS${RESET}` : 'TETRIS',
    '',
    `Score  ${game.score}`,
    `Level  ${game.level}`,
    `Lines  ${game.lines}`,
    '',
    'Next',
    ...nextPieceLines(game.next, color),
    '',
    ...CONTROLS,
    '',
    statusLine,
    game.gameOver ? 'Press r to restart' : '',
  ];
}

// Width (columns) and height (rows) the full layout needs.
export function layoutSize(game) {
  return { width: 2 + game.width * 2 + 2 + 18, height: game.height + 2 };
}

// Render the game to an array of lines, sized for a terminal of the given
// dimensions. Every result has at most MAX_ROWS lines.
export function render(game, { columns = 80, rows = MAX_ROWS, color = true } = {}) {
  const size = layoutSize(game);
  const availableRows = Math.min(rows, MAX_ROWS);
  if (columns < size.width || availableRows < size.height) {
    return [
      'Terminal too small for Tetris.',
      `Need ${size.width}x${size.height}, have ${columns}x${rows}.`,
      'Resize the window or press q to quit.',
    ].slice(0, Math.max(1, availableRows));
  }

  const board = boardLines(game, color);
  const panel = panelLines(game, color);
  return board.map((line, i) => `${line}  ${panel[i] ?? ''}`);
}

// Build the full escape sequence that repaints the screen with the lines.
export function frame(lines) {
  return `${ESC}H` + lines.map((line) => `${line}${ESC}K`).join('\r\n') + `${ESC}J`;
}
