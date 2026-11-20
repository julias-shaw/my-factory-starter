import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  Game,
  LINE_SCORES,
  PIECE_TYPES,
  createBag,
  createBoard,
  dropInterval,
  pieceCells,
} from '../src/game.js';
import { applyAction } from '../src/input.js';

// Build a game whose current piece is the given type at the spawn position.
function gameWith(type, options = {}) {
  const game = new Game({ random: () => 0, ...options });
  game.spawn(type);
  return game;
}

// Fill a row completely except for the listed columns.
function fillRow(game, y, gaps = []) {
  game.board[y] = game.board[y].map((_, x) => (gaps.includes(x) ? null : 'Z'));
}

const sortCells = (cells) => cells.map(([x, y]) => `${x},${y}`).sort();

test('a new game has an empty 10x20 board, score 0 and level 1', () => {
  const game = new Game();
  assert.equal(game.board.length, BOARD_HEIGHT);
  assert.ok(game.board.every((row) => row.length === BOARD_WIDTH && row.every((c) => c === null)));
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.equal(game.gameOver, false);
  assert.equal(game.paused, false);
  assert.ok(PIECE_TYPES.includes(game.current.type));
  assert.ok(PIECE_TYPES.includes(game.next));
});

test('createBoard builds independent rows', () => {
  const board = createBoard(4, 3);
  board[0][0] = 'I';
  assert.equal(board[1][0], null);
});

test('pieces spawn centered at the top in rotation 0', () => {
  for (const type of PIECE_TYPES) {
    const game = gameWith(type);
    assert.equal(game.current.rotation, 0);
    assert.equal(game.current.y, 0);
    const xs = pieceCells(game.current).map(([x]) => x);
    assert.ok(Math.min(...xs) >= 3 && Math.max(...xs) <= 6, `${type} spawns at ${xs}`);
  }
});

test('every tetromino has four cells in every rotation', () => {
  for (const type of PIECE_TYPES) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const cells = pieceCells({ type, rotation, x: 0, y: 0 });
      assert.equal(new Set(cells.map(String)).size, 4, `${type}/${rotation}`);
    }
  }
});

test('spawning advances the next-piece preview', () => {
  const game = new Game();
  const upcoming = game.next;
  game.spawn();
  assert.equal(game.current.type, upcoming);
});

test('7-bag randomizer yields each piece once per seven draws', () => {
  const draw = createBag(Math.random);
  for (let bag = 0; bag < 3; bag++) {
    const pieces = Array.from({ length: 7 }, draw);
    assert.deepEqual([...pieces].sort(), [...PIECE_TYPES].sort());
  }
});

test('pieces move left and right and stop at the walls', () => {
  const game = gameWith('O');
  const startX = game.current.x;
  assert.ok(game.moveLeft());
  assert.equal(game.current.x, startX - 1);
  assert.ok(game.moveRight());
  assert.equal(game.current.x, startX);

  while (game.moveLeft());
  assert.equal(Math.min(...pieceCells(game.current).map(([x]) => x)), 0);
  assert.equal(game.moveLeft(), false);

  while (game.moveRight());
  assert.equal(Math.max(...pieceCells(game.current).map(([x]) => x)), BOARD_WIDTH - 1);
  assert.equal(game.moveRight(), false);
});

test('pieces cannot move into occupied cells', () => {
  const game = gameWith('O');
  const [[x, y]] = pieceCells(game.current);
  game.board[y][x - 1] = 'Z';
  assert.equal(game.moveLeft(), false);
});

test('rotation cycles through four states in both directions', () => {
  const game = gameWith('T');
  game.tryMove(0, 5);
  for (let i = 1; i <= 4; i++) {
    assert.ok(game.rotateClockwise());
    assert.equal(game.current.rotation, i % 4);
  }
  assert.ok(game.rotateCounterClockwise());
  assert.equal(game.current.rotation, 3);
});

test('O piece rotation does not change its cells', () => {
  const game = gameWith('O');
  const before = sortCells(pieceCells(game.current));
  game.rotateClockwise();
  assert.deepEqual(sortCells(pieceCells(game.current)), before);
});

test('rotation against a wall uses a wall kick', () => {
  const game = gameWith('I');
  game.rotateClockwise(); // vertical
  game.tryMove(0, 5);
  while (game.moveLeft());
  assert.equal(Math.min(...pieceCells(game.current).map(([x]) => x)), 0);
  assert.ok(game.rotateClockwise(), 'kick should allow rotation');
  assert.ok(pieceCells(game.current).every(([x]) => x >= 0 && x < BOARD_WIDTH));
});

test('rotation fails when every kick is blocked', () => {
  const game = gameWith('I');
  game.tryMove(0, 10);
  const { y } = game.current;
  // Fill everything except the I piece's own row.
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    if (row !== y + 1) fillRow(game, row);
  }
  fillRow(game, y + 1, [3, 4, 5, 6]);
  const before = { ...game.current };
  assert.equal(game.rotateClockwise(), false);
  assert.deepEqual(game.current, before);
});

test('tick moves the piece down, then locks it at the floor', () => {
  const game = gameWith('O');
  const y = game.current.y;
  game.tick();
  assert.equal(game.current.y, y + 1);
  while (game.tryMove(0, 1));
  game.tick();
  assert.ok(game.board[BOARD_HEIGHT - 1].some((c) => c === 'O'));
  assert.equal(game.current.y, 0, 'a new piece spawns after locking');
});

test('soft drop scores 1 per row and hard drop scores 2 per row', () => {
  const soft = gameWith('O');
  soft.softDrop();
  soft.softDrop();
  assert.equal(soft.score, 2);

  const hard = gameWith('O');
  const distance = hard.hardDrop();
  assert.equal(distance, BOARD_HEIGHT - 2);
  assert.equal(hard.score, distance * 2);
  assert.deepEqual(
    hard.board[BOARD_HEIGHT - 1].map((c) => c !== null),
    [false, false, false, false, true, true, false, false, false, false],
  );
});

test('ghost shows where the piece would land', () => {
  const game = gameWith('O');
  const ghost = game.ghost();
  assert.equal(Math.max(...pieceCells(ghost).map(([, y]) => y)), BOARD_HEIGHT - 1);
  assert.equal(game.current.y, 0, 'ghost does not move the piece');
});

test('clearing a single line removes it, shifts rows down and scores', () => {
  const game = gameWith('I');
  fillRow(game, BOARD_HEIGHT - 1, [3, 4, 5, 6]);
  game.board[BOARD_HEIGHT - 2][0] = 'J';
  game.hardDrop();
  assert.equal(game.lines, 1);
  assert.equal(game.lastClear, 1);
  assert.equal(game.score, LINE_SCORES[1] + (BOARD_HEIGHT - 2) * 2);
  assert.equal(game.board[BOARD_HEIGHT - 1][0], 'J', 'row above shifted down');
  assert.ok(game.board[BOARD_HEIGHT - 1].slice(1).every((c) => c === null));
});

test('clearing four lines at once scores a tetris', () => {
  const game = gameWith('I');
  game.rotateClockwise(); // vertical, occupies column 5
  const column = pieceCells(game.current)[0][0];
  for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y++) fillRow(game, y, [column]);
  const distance = game.hardDrop();
  assert.equal(game.lines, 4);
  assert.equal(game.score, LINE_SCORES[4] + distance * 2);
  assert.ok(game.board.every((row) => row.every((c) => c === null)));
});

test('line scores are multiplied by the current level', () => {
  const game = gameWith('I');
  game.level = 3;
  game.lines = 20;
  fillRow(game, BOARD_HEIGHT - 1, [3, 4, 5, 6]);
  const distance = game.hardDrop();
  assert.equal(game.lines, 21);
  assert.equal(game.level, 3);
  assert.equal(game.score, LINE_SCORES[1] * 3 + distance * 2);
});

test('level increases every 10 lines and gravity speeds up', () => {
  const game = gameWith('I');
  game.lines = 9;
  fillRow(game, BOARD_HEIGHT - 1, [3, 4, 5, 6]);
  const before = game.interval;
  game.hardDrop();
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
  assert.ok(game.interval < before);
});

test('dropInterval decreases with level and has a floor', () => {
  assert.equal(dropInterval(1), 1000);
  for (let level = 1; level < 30; level++) {
    assert.ok(dropInterval(level + 1) <= dropInterval(level));
  }
  assert.equal(dropInterval(100), 50);
});

test('game over when a new piece cannot spawn, and the game freezes', () => {
  const game = new Game({ random: () => 0.3 });
  let drops = 0;
  while (!game.gameOver && drops < 200) {
    game.hardDrop();
    drops++;
  }
  assert.ok(game.gameOver);
  const snapshot = JSON.stringify([game.board, game.current, game.score]);
  game.moveLeft();
  game.rotateClockwise();
  game.softDrop();
  game.hardDrop();
  game.tick();
  game.togglePause();
  assert.equal(game.paused, false, 'cannot pause after game over');
  assert.equal(JSON.stringify([game.board, game.current, game.score]), snapshot);
});

test('spawning into an occupied area ends the game', () => {
  const game = new Game();
  fillRow(game, 0);
  fillRow(game, 1);
  assert.equal(game.spawn('T'), false);
  assert.ok(game.gameOver);
});

test('pausing blocks movement and gravity until resumed', () => {
  const game = gameWith('T');
  game.togglePause();
  assert.ok(game.paused);
  const before = { ...game.current };
  game.moveLeft();
  game.tick();
  game.hardDrop();
  assert.deepEqual(game.current, before);
  game.togglePause();
  assert.ok(game.moveLeft());
});

test('restart resets board, score, lines, level and state', () => {
  const game = new Game({ random: () => 0.3 });
  while (!game.gameOver) game.hardDrop();
  applyAction(game, 'restart');
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.ok(game.board.every((row) => row.every((c) => c === null)));
  assert.ok(game.active);
});

test('applyAction routes actions to the game and reports quit', () => {
  const game = gameWith('T');
  const x = game.current.x;
  assert.equal(applyAction(game, 'moveLeft'), null);
  assert.equal(game.current.x, x - 1);
  applyAction(game, 'moveRight');
  assert.equal(game.current.x, x);
  applyAction(game, 'rotateClockwise');
  assert.equal(game.current.rotation, 1);
  applyAction(game, 'rotateCounterClockwise');
  assert.equal(game.current.rotation, 0);
  applyAction(game, 'softDrop');
  assert.equal(game.current.y, 1);
  applyAction(game, 'pause');
  assert.ok(game.paused);
  applyAction(game, 'pause');
  applyAction(game, 'hardDrop');
  assert.ok(game.board[BOARD_HEIGHT - 1].some((c) => c === 'T'));
  assert.equal(applyAction(game, 'quit'), 'quit');
  assert.equal(applyAction(game, 'unknown'), null);
});
