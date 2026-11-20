// Core Tetris rules: no terminal I/O here so the mechanics can be tested.

export const WIDTH = 10;
export const HEIGHT = 20;

// Spawn orientation of each tetromino; 1 marks a filled cell.
export const SHAPES = {
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

export const PIECE_TYPES = Object.keys(SHAPES);

// Points for clearing 1-4 lines at once, multiplied by the level.
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const LINES_PER_LEVEL = 10;

// Offsets tried in order when a rotation collides (simple wall/floor kicks).
const KICKS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
];

export function rotateShape(shape) {
  const n = shape.length;
  return shape.map((row, y) => row.map((_, x) => shape[n - 1 - x][y]));
}

export function emptyBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
}

// Milliseconds between gravity steps; speeds up each level with a floor.
export function gravityInterval(level) {
  return Math.max(100, 800 - (level - 1) * 70);
}

// 7-bag randomizer: every piece appears once per bag of seven.
export function createBag(rng = Math.random) {
  let bag = [];
  return function next() {
    if (bag.length === 0) {
      bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  };
}

export function cells(piece) {
  const out = [];
  piece.shape.forEach((row, dy) => {
    row.forEach((filled, dx) => {
      if (filled) out.push([piece.x + dx, piece.y + dy]);
    });
  });
  return out;
}

export function collides(board, piece) {
  return cells(piece).some(
    ([x, y]) => x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y][x] !== null,
  );
}

function makePiece(type) {
  const shape = SHAPES[type].map((row) => [...row]);
  return { type, shape, x: Math.floor((WIDTH - shape[0].length) / 2), y: 0 };
}

export function createGame({ rng = Math.random, nextPiece } = {}) {
  const game = {
    board: emptyBoard(),
    current: null,
    next: null,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    paused: false,
  };
  let draw = nextPiece ?? createBag(rng);

  function spawn() {
    game.current = makePiece(game.next);
    game.next = draw();
    if (collides(game.board, game.current)) {
      game.gameOver = true;
      return false;
    }
    return true;
  }

  function active() {
    return !game.gameOver && !game.paused && game.current !== null;
  }

  function tryMove(dx, dy) {
    const moved = { ...game.current, x: game.current.x + dx, y: game.current.y + dy };
    if (collides(game.board, moved)) return false;
    game.current = moved;
    return true;
  }

  function clearLines() {
    const kept = game.board.filter((row) => row.some((cell) => cell === null));
    const cleared = HEIGHT - kept.length;
    while (kept.length < HEIGHT) kept.unshift(Array(WIDTH).fill(null));
    game.board = kept;
    if (cleared > 0) {
      game.score += LINE_SCORES[cleared] * game.level;
      game.lines += cleared;
      game.level = Math.floor(game.lines / LINES_PER_LEVEL) + 1;
    }
    return cleared;
  }

  function lock() {
    for (const [x, y] of cells(game.current)) game.board[y][x] = game.current.type;
    const cleared = clearLines();
    spawn();
    return cleared;
  }

  game.moveLeft = () => active() && tryMove(-1, 0);
  game.moveRight = () => active() && tryMove(1, 0);

  game.rotate = () => {
    if (!active()) return false;
    const shape = rotateShape(game.current.shape);
    for (const [dx, dy] of KICKS) {
      const candidate = { ...game.current, shape, x: game.current.x + dx, y: game.current.y + dy };
      if (!collides(game.board, candidate)) {
        game.current = candidate;
        return true;
      }
    }
    return false;
  };

  // Gravity step: fall one row, or lock in place if blocked.
  game.tick = () => {
    if (!active()) return false;
    if (tryMove(0, 1)) return true;
    lock();
    return true;
  };

  // Player soft drop: like gravity, plus one point per row descended.
  game.softDrop = () => {
    if (!active()) return false;
    if (tryMove(0, 1)) {
      game.score += 1;
      return true;
    }
    lock();
    return true;
  };

  // Hard drop: fall to the bottom and lock immediately, two points per row.
  game.hardDrop = () => {
    if (!active()) return false;
    let rows = 0;
    while (tryMove(0, 1)) rows += 1;
    game.score += rows * 2;
    lock();
    return true;
  };

  // Row the current piece would land on, for drawing a ghost piece.
  game.ghost = () => {
    if (!game.current) return null;
    let ghost = game.current;
    for (;;) {
      const lower = { ...ghost, y: ghost.y + 1 };
      if (collides(game.board, lower)) return ghost;
      ghost = lower;
    }
  };

  game.togglePause = () => {
    if (game.gameOver) return false;
    game.paused = !game.paused;
    return true;
  };

  game.restart = () => {
    game.board = emptyBoard();
    game.score = 0;
    game.lines = 0;
    game.level = 1;
    game.gameOver = false;
    game.paused = false;
    if (!nextPiece) draw = createBag(rng);
    game.next = draw();
    spawn();
  };

  game.restart();
  return game;
}
