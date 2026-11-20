// Build the game screen as an array of text lines. Pure: no terminal I/O.
import { WIDTH, HEIGHT, SHAPES, cells } from './game.js';

// Largest screen the game may occupy (rows are the hard limit from the spec).
export const MAX_ROWS = 24;
export const MAX_COLS = 80;

const CSI = '\u001b[';
const RESET = `${CSI}0m`;

// Foreground colour for each piece type.
const COLORS = {
  I: `${CSI}96m`, // bright cyan
  O: `${CSI}93m`, // bright yellow
  T: `${CSI}95m`, // bright magenta
  S: `${CSI}92m`, // bright green
  Z: `${CSI}91m`, // bright red
  J: `${CSI}94m`, // bright blue
  L: `${CSI}33m`, // yellow/orange
  X: `${CSI}37m`, // fallback for unknown cells
};
const DIM = `${CSI}2m`;
const BOLD = `${CSI}1m`;

const BLOCK = '██';
const GHOST = '░░';
const EMPTY = ' .';

const CONTROLS = [
  'Controls',
  ' ←/a →/d  move',
  ' ↑/w      rotate',
  ' ↓/s      soft drop',
  ' Space    hard drop',
  ' p        pause',
  ' r        restart',
  ' q        quit',
];

// Strip ANSI escape sequences so width can be measured.
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');
}

export function visibleWidth(text) {
  return [...stripAnsi(text)].length;
}

function paint(text, style, color) {
  return color && style ? `${style}${text}${RESET}` : text;
}

function block(type, color) {
  return paint(BLOCK, COLORS[type] ?? COLORS.X, color);
}

// Centre `text` within `width` columns.
function centre(text, width) {
  const left = Math.max(0, Math.floor((width - text.length) / 2));
  return `${' '.repeat(left)}${text}`.padEnd(width);
}

// Rows of the playfield interior (2 columns per cell), with the ghost and
// falling piece drawn over the locked cells.
function boardRows(game, color) {
  const grid = game.board.map((row) => row.map((cell) => (cell ? block(cell, color) : EMPTY)));
  if (game.current && !game.gameOver) {
    const ghost = game.ghost();
    if (ghost) {
      for (const [x, y] of cells(ghost)) {
        if (y >= 0 && y < HEIGHT && !game.board[y][x]) grid[y][x] = paint(GHOST, DIM, color);
      }
    }
    for (const [x, y] of cells(game.current)) {
      if (y >= 0 && y < HEIGHT) grid[y][x] = block(game.current.type, color);
    }
  }
  const rows = grid.map((row) => row.join(''));

  // Overlay a centred message box for paused / game-over states.
  let message = null;
  if (game.gameOver) message = ['GAME OVER', `Score ${game.score}`, 'r: restart', 'q: quit'];
  else if (game.paused) message = ['PAUSED', 'p: resume'];
  if (message) {
    const inner = WIDTH * 2;
    const boxed = [
      '─'.repeat(inner),
      ...message.map((m) => centre(m, inner)),
      '─'.repeat(inner),
    ];
    const top = Math.floor((HEIGHT - boxed.length) / 2);
    boxed.forEach((line, i) => {
      const styled = i === 0 || i === boxed.length - 1 ? line : paint(line, BOLD, color);
      rows[top + i] = styled;
    });
  }
  return rows;
}

// Two rows showing the next piece, trimmed to its filled rows.
function previewRows(type, color) {
  if (!type) return ['', ''];
  const filled = SHAPES[type].filter((row) => row.some(Boolean));
  const rows = filled.map((row) => row.map((c) => (c ? block(type, color) : '  ')).join(''));
  while (rows.length < 2) rows.push('');
  return rows;
}

function panelRows(game, color) {
  let status = 'Playing';
  if (game.gameOver) status = paint('GAME OVER', BOLD, color);
  else if (game.paused) status = paint('PAUSED', BOLD, color);
  return [
    paint('T E T R I S', BOLD, color),
    '',
    `Score  ${game.score}`,
    `Lines  ${game.lines}`,
    `Level  ${game.level}`,
    '',
    'Next',
    ...previewRows(game.next, color).map((r) => ` ${r}`),
    '',
    ...CONTROLS,
    '',
    status,
  ];
}

// Full screen: bordered board on the left, info panel on the right.
// Returns HEIGHT + 2 lines (22), within MAX_ROWS.
export function renderLines(game, { color = true } = {}) {
  const inner = WIDTH * 2;
  const board = [
    `┌${'─'.repeat(inner)}┐`,
    ...boardRows(game, color).map((row) => `│${row}│`),
    `└${'─'.repeat(inner)}┘`,
  ];
  const panel = panelRows(game, color);
  return board.map((line, i) => (panel[i] ? `${line}  ${panel[i]}` : line));
}

export function render(game, options) {
  return renderLines(game, options).join('\n');
}
