#!/usr/bin/env node

const WIDTH = 10;
const HEIGHT = 20;
const TICK_MS = 500;

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const SHAPE_KEYS = Object.keys(SHAPES);

function cloneMatrix(matrix) {
  return matrix.map(row => row.slice());
}

function randomShapeKey() {
  return SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
}

function rotateClockwise(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      rotated[x][rows - 1 - y] = shape[y][x];
    }
  }
  return rotated;
}

function createBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
}

function createPiece(shapeKey) {
  const key = shapeKey || randomShapeKey();
  const shape = SHAPES[key];
  return {
    shape: cloneMatrix(shape),
    x: Math.floor((WIDTH - shape[0].length) / 2),
    y: 0,
    type: key,
  };
}

function isValidPosition(board, piece) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (!piece.shape[y][x]) continue;
      const boardX = piece.x + x;
      const boardY = piece.y + y;
      if (boardX < 0 || boardX >= WIDTH || boardY >= HEIGHT) return false;
      if (boardY >= 0 && board[boardY][boardX]) return false;
    }
  }
  return true;
}

function movePiece(board, piece, dx, dy) {
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
  if (isValidPosition(board, moved)) {
    piece.x = moved.x;
    piece.y = moved.y;
    return true;
  }
  return false;
}

function tryRotatePiece(board, piece) {
  const rotatedShape = rotateClockwise(piece.shape);
  const kicks = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-2, 0],
    [2, 0],
  ];
  for (const [dx, dy] of kicks) {
    const candidate = {
      ...piece,
      shape: rotatedShape,
      x: piece.x + dx,
      y: piece.y + dy,
    };
    if (isValidPosition(board, candidate)) {
      piece.shape = rotatedShape;
      piece.x = candidate.x;
      piece.y = candidate.y;
      return true;
    }
  }
  return false;
}

function lockPiece(board, piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      const boardY = piece.y + y;
      const boardX = piece.x + x;
      if (boardY >= 0 && boardY < HEIGHT && boardX >= 0 && boardX < WIDTH) {
        board[boardY][boardX] = 1;
      }
    });
  });
}

function overlayPiece(board, piece) {
  const copy = board.map(row => row.slice());
  if (!piece) return copy;
  piece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      const boardY = piece.y + y;
      const boardX = piece.x + x;
      if (boardY >= 0 && boardY < HEIGHT && boardX >= 0 && boardX < WIDTH) {
        copy[boardY][boardX] = cell;
      }
    });
  });
  return copy;
}

function renderBoard(board) {
  const horizontal = '-'.repeat(WIDTH * 2);
  const rows = [];
  rows.push('+' + horizontal + '+');
  for (let y = 0; y < HEIGHT; y++) {
    let line = '|';
    for (let x = 0; x < WIDTH; x++) {
      line += board[y][x] ? '[]' : '  ';
    }
    line += '|';
    rows.push(line);
  }
  rows.push('+' + horizontal + '+');
  return rows;
}

function render(state) {
  const score = String(state.score).padStart(5, ' ');
  const lines = String(state.lines).padStart(5, ' ');
  const level = String(state.level).padStart(2, ' ');

  const header = ` TETRIS        Score:${score}  Lines:${lines}  Level:${level}`;
  const footer = state.gameOver
    ? ' >>> GAME OVER <<<          Press Q to quit'
    : ' Controls: Left/Down/Right move   Space: rotate   Q: quit';

  const panel = [
    '',
    ' Next piece:',
    '      ',
    '',
    ' Score',
    ` ${score}`,
    '',
    ' Lines',
    ` ${lines}`,
    '',
    ' Level',
    ` ${level}`,
    '',
    ' Controls',
    ' Left  ',
    ' Down  ',
    ' Right ',
    ' Space ',
    ' Q     ',
    '',
  ];

  const displayBoard = overlayPiece(state.board, state.piece);
  const boardRows = renderBoard(displayBoard);
  const rows = [];
  rows.push(header.slice(0, 80));

  for (let y = 0; y < boardRows.length; y++) {
    const p = panel[y] ?? '';
    rows.push((boardRows[y] + '  ' + p).slice(0, 80));
  }

  rows.push(footer.slice(0, 80));

  while (rows.length < 24) {
    rows.push('');
  }

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(rows.slice(0, 24).join('\n') + '\n');
}

function spawnPiece(state) {
  state.piece = createPiece(randomShapeKey());
  if (!isValidPosition(state.board, state.piece)) {
    state.gameOver = true;
  }
}

function tick(state) {
  if (state.gameOver) {
    render(state);
    return;
  }
  if (!state.piece) {
    spawnPiece(state);
  }
  if (state.piece && !movePiece(state.board, state.piece, 0, 1)) {
    lockPiece(state.board, state.piece);
    spawnPiece(state);
  }
  render(state);
}

const state = {
  board: createBoard(),
  piece: null,
  score: 0,
  lines: 0,
  level: 1,
  gameOver: false,
};

function setupInput(state) {
  const readline = require('readline');
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', (str, key) => {
    if (key && key.ctrl && key.name === 'c') {
      process.exit();
    }

    if (state.gameOver) {
      if (key && (key.name === 'q' || str === 'q' || str === 'Q')) {
        process.exit();
      }
      return;
    }

    if (!state.piece) return;

    switch (key && key.name) {
      case 'left':
        movePiece(state.board, state.piece, -1, 0);
        break;
      case 'right':
        movePiece(state.board, state.piece, 1, 0);
        break;
      case 'down':
        movePiece(state.board, state.piece, 0, 1);
        break;
      case 'space':
        tryRotatePiece(state.board, state.piece);
        break;
      case 'up':
        tryRotatePiece(state.board, state.piece);
        break;
      case 'q':
      case 'Q':
        process.exit();
        break;
      default:
        if (str === 'q' || str === 'Q') process.exit();
        break;
    }

    render(state);
  });
}

if (require.main === module) {
  spawnPiece(state);
  render(state);
  setupInput(state);
  const interval = setInterval(() => tick(state), TICK_MS);

  process.once('SIGINT', () => {
    clearInterval(interval);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit();
  });
}

module.exports = {
  WIDTH,
  HEIGHT,
  TICK_MS,
  SHAPES,
  createBoard,
  createPiece,
  renderBoard,
  render,
  rotateClockwise,
  isValidPosition,
  movePiece,
  tryRotatePiece,
  lockPiece,
  overlayPiece,
};
