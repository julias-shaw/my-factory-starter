// Pure Tetris rules: pieces, movement, rotation, gravity, line clears,
// scoring, and game over/restart. No terminal I/O lives here.

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Base shapes in their spawn orientation, laid out in an n×n box so that
// rotation stays centered.
export const SHAPES = {
  I: ['....', 'IIII', '....', '....'],
  O: ['OO', 'OO'],
  T: ['.T.', 'TTT', '...'],
  S: ['.SS', 'SS.', '...'],
  Z: ['ZZ.', '.ZZ', '...'],
  J: ['J..', 'JJJ', '...'],
  L: ['..L', 'LLL', '...'],
};

export const PIECE_TYPES = Object.keys(SHAPES);

// Points for clearing 1–4 lines at once, multiplied by the current level.
export const LINE_SCORES = [0, 100, 300, 500, 800];

function shapeCells(rows) {
  const cells = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') cells.push([x, y]);
    });
  });
  return cells;
}

// Rotates cells clockwise inside an n×n box.
function rotateCells(cells, n) {
  return cells.map(([x, y]) => [n - 1 - y, x]);
}

// ROTATIONS[type][r] is the list of [x, y] cells for rotation r (0–3).
export const ROTATIONS = Object.fromEntries(
  PIECE_TYPES.map((type) => {
    const n = SHAPES[type].length;
    const states = [shapeCells(SHAPES[type])];
    for (let r = 1; r < 4; r += 1) states.push(rotateCells(states[r - 1], n));
    return [type, states];
  }),
);

// Offsets tried in order when a rotation collides (simple wall/floor kicks).
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2]];

export function emptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

// Milliseconds between automatic one-row drops at a given level.
export function gravityInterval(level) {
  return Math.max(100, 1000 - (level - 1) * 75);
}

// A "7-bag" randomizer: every piece appears once per seven before repeating.
export function createBag(random = Math.random) {
  let bag = [];
  return () => {
    if (bag.length === 0) {
      bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  };
}

export function pieceCells(piece) {
  return ROTATIONS[piece.type][piece.rotation].map(([x, y]) => [x + piece.x, y + piece.y]);
}

export function collides(board, piece) {
  return pieceCells(piece).some(([x, y]) => (
    x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT || (y >= 0 && board[y][x] !== null)
  ));
}

function spawnPiece(type) {
  const n = SHAPES[type].length;
  return { type, rotation: 0, x: Math.floor((BOARD_WIDTH - n) / 2), y: 0 };
}

export function createGame({ random = Math.random, nextPiece } = {}) {
  const draw = nextPiece ?? createBag(random);
  const game = {
    board: emptyBoard(),
    current: null,
    next: null,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    dropTimer: 0,
  };

  function spawn() {
    const type = game.next ?? draw();
    game.next = draw();
    game.current = spawnPiece(type);
    game.dropTimer = 0;
    if (collides(game.board, game.current)) game.gameOver = true;
  }

  function tryMove(dx, dy, rotation = game.current.rotation) {
    const moved = { ...game.current, x: game.current.x + dx, y: game.current.y + dy, rotation };
    if (collides(game.board, moved)) return false;
    game.current = moved;
    return true;
  }

  function clearLines() {
    const kept = game.board.filter((row) => row.some((cell) => cell === null));
    const cleared = BOARD_HEIGHT - kept.length;
    while (kept.length < BOARD_HEIGHT) kept.unshift(Array(BOARD_WIDTH).fill(null));
    game.board = kept;
    if (cleared > 0) {
      game.score += LINE_SCORES[cleared] * game.level;
      game.lines += cleared;
      game.level = Math.floor(game.lines / 10) + 1;
    }
    return cleared;
  }

  // Locks the current piece into the board, clears lines, and spawns next.
  function lock() {
    for (const [x, y] of pieceCells(game.current)) {
      if (y < 0) {
        game.gameOver = true;
        continue;
      }
      game.board[y][x] = game.current.type;
    }
    const cleared = clearLines();
    if (!game.gameOver) spawn();
    return cleared;
  }

  const api = {
    get state() {
      return game;
    },
    moveLeft() {
      return !game.gameOver && tryMove(-1, 0);
    },
    moveRight() {
      return !game.gameOver && tryMove(1, 0);
    },
    rotate(dir = 1) {
      if (game.gameOver) return false;
      const rotation = (game.current.rotation + dir + 4) % 4;
      return KICKS.some(([dx, dy]) => tryMove(dx, dy, rotation));
    },
    // Moves down one row; locks the piece if it cannot move. Awards 1 point
    // per row when triggered by the player.
    softDrop() {
      if (game.gameOver) return false;
      if (tryMove(0, 1)) {
        game.score += 1;
        game.dropTimer = 0;
        return true;
      }
      lock();
      return false;
    },
    // Drops the piece to the bottom and locks it. Awards 2 points per row.
    hardDrop() {
      if (game.gameOver) return 0;
      let rows = 0;
      while (tryMove(0, 1)) rows += 1;
      game.score += rows * 2;
      lock();
      return rows;
    },
    // Advances gravity by dtMs, dropping (and locking) as needed.
    tick(dtMs) {
      if (game.gameOver) return;
      game.dropTimer += dtMs;
      const interval = gravityInterval(game.level);
      while (game.dropTimer >= interval && !game.gameOver) {
        game.dropTimer -= interval;
        if (!tryMove(0, 1)) {
          lock();
          break;
        }
      }
    },
    // Row the current piece would land on (for a ghost preview).
    ghostY() {
      let y = game.current.y;
      while (!collides(game.board, { ...game.current, y: y + 1 })) y += 1;
      return y;
    },
    restart() {
      game.board = emptyBoard();
      game.score = 0;
      game.lines = 0;
      game.level = 1;
      game.gameOver = false;
      game.next = null;
      spawn();
    },
  };

  spawn();
  return api;
}
