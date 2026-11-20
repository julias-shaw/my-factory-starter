import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEIGHT,
  WIDTH,
  PIECE_TYPES,
  cells,
  collides,
  createBag,
  createGame,
  gravityInterval,
  rotateShape,
} from '../src/game.js';

// Deterministic piece supply for tests.
function sequence(...types) {
  let i = 0;
  return () => types[i++ % types.length];
}

function fillRow(game, y, except = []) {
  for (let x = 0; x < WIDTH; x += 1) game.board[y][x] = except.includes(x) ? null : 'X';
}

test('a new game spawns a piece at the top centre with a next piece queued', () => {
  const game = createGame({ nextPiece: sequence('T', 'O') });
  assert.equal(game.current.type, 'T');
  assert.equal(game.next, 'O');
  assert.equal(game.current.y, 0);
  assert.deepEqual(cells(game.current).sort(), [[3, 1], [4, 0], [4, 1], [5, 1]].sort());
  assert.equal(game.score, 0);
  assert.equal(game.level, 1);
  assert.equal(game.gameOver, false);
});

test('7-bag randomizer deals every piece once per bag', () => {
  const next = createBag(() => 0.5);
  for (let bag = 0; bag < 3; bag += 1) {
    const dealt = Array.from({ length: 7 }, next);
    assert.deepEqual([...dealt].sort(), [...PIECE_TYPES].sort());
  }
});

test('pieces move left and right but stop at the walls', () => {
  const game = createGame({ nextPiece: sequence('O') });
  const startX = game.current.x;
  assert.equal(game.moveLeft(), true);
  assert.equal(game.current.x, startX - 1);
  while (game.moveLeft());
  assert.equal(Math.min(...cells(game.current).map(([x]) => x)), 0);
  while (game.moveRight());
  assert.equal(Math.max(...cells(game.current).map(([x]) => x)), WIDTH - 1);
  assert.equal(game.moveRight(), false);
});

test('pieces cannot move into settled blocks', () => {
  const game = createGame({ nextPiece: sequence('O') });
  game.board[0][3] = 'X';
  assert.equal(game.moveLeft(), false);
  assert.equal(game.current.x, 4);
});

test('rotation turns the piece clockwise', () => {
  assert.deepEqual(rotateShape([[0, 1, 0], [1, 1, 1], [0, 0, 0]]), [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
  const game = createGame({ nextPiece: sequence('T') });
  assert.equal(game.rotate(), true);
  assert.deepEqual(game.current.shape, [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
  for (let i = 0; i < 3; i += 1) game.rotate();
  assert.deepEqual(game.current.shape, [[0, 1, 0], [1, 1, 1], [0, 0, 0]]);
});

test('rotation against a wall kicks the piece back inside', () => {
  const game = createGame({ nextPiece: sequence('I') });
  game.rotate(); // vertical
  while (game.moveRight());
  assert.equal(game.rotate(), true); // horizontal again, must kick left
  assert.equal(collides(game.board, game.current), false);
  assert.ok(cells(game.current).every(([x]) => x >= 0 && x < WIDTH));
});

test('blocked rotation leaves the piece unchanged', () => {
  const game = createGame({ nextPiece: sequence('I') });
  game.tick();
  game.tick();
  // Surround the horizontal I so no kick fits a vertical I.
  for (let x = 0; x < WIDTH; x += 1) {
    for (const y of [0, 1, 2, 4, 5, 6]) game.board[y][x] = 'X';
  }
  const before = { ...game.current };
  assert.equal(game.rotate(), false);
  assert.deepEqual(game.current, before);
});

test('gravity moves the piece down one row per tick', () => {
  const game = createGame({ nextPiece: sequence('O') });
  game.tick();
  assert.equal(game.current.y, 1);
  game.tick();
  assert.equal(game.current.y, 2);
});

test('a piece locks when it cannot fall and the next piece spawns', () => {
  const game = createGame({ nextPiece: sequence('O', 'T') });
  for (let i = 0; i < HEIGHT - 2; i += 1) game.tick();
  assert.equal(game.current.type, 'O');
  assert.equal(game.current.y, HEIGHT - 2);
  game.tick();
  assert.equal(game.board[HEIGHT - 1][4], 'O');
  assert.equal(game.board[HEIGHT - 1][5], 'O');
  assert.equal(game.board[HEIGHT - 2][4], 'O');
  assert.equal(game.current.type, 'T');
  assert.equal(game.current.y, 0);
});

test('soft drop moves down and scores one point per row', () => {
  const game = createGame({ nextPiece: sequence('O') });
  game.softDrop();
  game.softDrop();
  assert.equal(game.current.y, 2);
  assert.equal(game.score, 2);
});

test('hard drop lands and locks immediately, scoring two points per row', () => {
  const game = createGame({ nextPiece: sequence('O', 'T') });
  game.hardDrop();
  assert.equal(game.board[HEIGHT - 1][4], 'O');
  assert.equal(game.score, (HEIGHT - 2) * 2);
  assert.equal(game.current.type, 'T');
});

test('ghost shows where the piece would land', () => {
  const game = createGame({ nextPiece: sequence('O') });
  assert.equal(game.ghost().y, HEIGHT - 2);
  assert.equal(game.current.y, 0);
});

test('completed lines are cleared and rows above shift down', () => {
  const game = createGame({ nextPiece: sequence('O') });
  fillRow(game, HEIGHT - 1, [4, 5]);
  fillRow(game, HEIGHT - 2, [4, 5]);
  game.board[HEIGHT - 3][0] = 'Z';
  game.hardDrop();
  assert.equal(game.lines, 2);
  assert.equal(game.board[HEIGHT - 1][0], 'Z');
  assert.ok(game.board[HEIGHT - 2].every((cell) => cell === null));
  assert.equal(game.score, (HEIGHT - 2) * 2 + 300);
});

test('line clear scores scale with lines cleared and level', () => {
  for (const [count, points] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
    const game = createGame({ nextPiece: sequence('I') });
    game.rotate(); // vertical I occupies column 5
    const col = cells(game.current)[0][0];
    for (let i = 0; i < count; i += 1) fillRow(game, HEIGHT - 1 - i, [col]);
    game.level = 2;
    const before = game.score;
    let dropped = 0;
    while (game.softDrop() && game.current.type === 'I' && game.lines === 0) dropped += 1;
    assert.equal(game.lines, count);
    assert.equal(game.score - before - dropped, points * 2, `${count} lines`);
  }
});

test('level rises every ten lines and gravity speeds up', () => {
  const game = createGame({ nextPiece: sequence('O') });
  game.lines = 9;
  fillRow(game, HEIGHT - 1, [4, 5]);
  game.hardDrop();
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
  assert.ok(gravityInterval(2) < gravityInterval(1));
  assert.ok(gravityInterval(50) >= 100);
});

test('game over when a new piece cannot spawn', () => {
  const game = createGame({ nextPiece: sequence('O') });
  for (let y = 2; y < HEIGHT; y += 1) fillRow(game, y, [0]);
  game.hardDrop();
  assert.equal(game.gameOver, true);
  // No further input changes anything.
  const snapshot = JSON.stringify(game);
  assert.equal(game.moveLeft(), false);
  assert.equal(game.tick(), false);
  assert.equal(game.hardDrop(), false);
  assert.equal(game.togglePause(), false);
  assert.equal(JSON.stringify(game), snapshot);
});

test('pause freezes the piece until resumed', () => {
  const game = createGame({ nextPiece: sequence('O') });
  game.togglePause();
  assert.equal(game.tick(), false);
  assert.equal(game.moveLeft(), false);
  assert.equal(game.current.y, 0);
  game.togglePause();
  assert.equal(game.tick(), true);
  assert.equal(game.current.y, 1);
});

test('restart resets the board, score, and game over state', () => {
  const game = createGame({ nextPiece: sequence('O') });
  for (let y = 2; y < HEIGHT; y += 1) fillRow(game, y, [0]);
  game.hardDrop();
  assert.equal(game.gameOver, true);
  game.restart();
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.ok(game.board.every((row) => row.every((cell) => cell === null)));
  assert.equal(game.current.y, 0);
});
