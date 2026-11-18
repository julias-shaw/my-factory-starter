'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOARD_WIDTH, BOARD_HEIGHT, SHAPES, createBoard, createPiece, canPlace,
  movePiece, rotatePiece, clearRows, advancePiece, hardDrop, render,
} = require('../index');

const square = (x = 4, y = 0) => ({ type: 'O', shape: [[1, 1], [1, 1]], x, y });
const occupied = board => board.flat().filter(cell => cell !== null).length;

test('board rows are independent and all seven pieces spawn legally with copied shapes', () => {
  const board = createBoard();
  assert.equal(board.length, BOARD_HEIGHT);
  assert.ok(board.every(row => row.length === BOARD_WIDTH && row.every(cell => cell === null)));
  board[0][0] = 'J';
  assert.equal(board[1][0], null);
  const types = Object.keys(SHAPES);
  assert.equal(types.length, 7);
  types.forEach((type, i) => {
    const piece = createPiece(() => (i + 0.5) / types.length);
    assert.equal(piece.type, type);
    assert.equal(piece.shape.flat().filter(Boolean).length, 4);
    assert.ok(canPlace(createBoard(), piece));
    piece.shape[0][0] = 99;
    assert.notEqual(SHAPES[type][0][0], 99);
  });
});

test('movement rejects walls and occupied cells without changing the piece', () => {
  const board = createBoard();
  const piece = square(0);
  assert.equal(movePiece(board, piece, -1), false);
  assert.equal(piece.x, 0);
  assert.equal(movePiece(board, piece, 1), true);
  board[0][3] = 'T';
  assert.equal(movePiece(board, piece, 1), false);
  piece.x = 8;
  assert.equal(movePiece(board, piece, 1), false);
  assert.equal(canPlace(board, piece, 8, 19), false);
  assert.equal(canPlace(board, piece, 8, -1), false);
});

test('rotation cycles shapes, adjusts at walls, and rejects blocked rotations', () => {
  const board = createBoard();
  const piece = createPiece(() => 0); // I
  const original = structuredClone(piece);
  for (let i = 0; i < 4; i++) assert.equal(rotatePiece(board, piece), true);
  assert.deepEqual(piece, original);
  rotatePiece(board, piece);
  piece.x = 9;
  assert.equal(rotatePiece(board, piece), true);
  assert.equal(piece.x, 6);
  assert.ok(canPlace(board, piece));

  const blocked = createBoard().map(row => row.map(() => 'Z'));
  const trapped = square();
  for (let y = 0; y < 2; y++) for (let x = 4; x < 6; x++) blocked[y][x] = null;
  trapped.shape = [[1], [1], [1], [1]];
  blocked[2][4] = blocked[3][4] = null;
  const before = structuredClone(trapped);
  assert.equal(rotatePiece(blocked, trapped), false);
  assert.deepEqual(trapped, before);
});

test('soft drop moves one row, then locks and spawns on collision', () => {
  const board = createBoard();
  const piece = square(4, 17);
  const stats = { score: 0 };
  assert.equal(advancePiece(board, piece, () => 0, stats), piece);
  assert.equal(piece.y, 18);
  assert.equal(occupied(board), 0);
  const next = advancePiece(board, piece, () => 0, stats);
  assert.equal(occupied(board), 4);
  assert.equal(next.type, 'I');
  assert.equal(next.y, 0);
  assert.equal(stats.score, 0);
});

test('hard drop lands on a stack and immediately locks', () => {
  const board = createBoard();
  board[18][4] = 'T';
  const piece = square();
  const next = hardDrop(board, piece, () => 0);
  assert.equal(piece.y, 16);
  assert.equal(occupied(board), 5);
  assert.equal(board[17][4], 'O');
  assert.equal(next.type, 'I');
});

test('row clearing preserves order and creates independent empty rows', () => {
  const board = createBoard();
  board[17][2] = 'T';
  board[18].fill('I');
  board[19].fill('I');
  assert.equal(clearRows(board), 2);
  assert.equal(board.length, BOARD_HEIGHT);
  assert.equal(board[19][2], 'T');
  board[0][0] = 'O';
  assert.equal(board[1][0], null);
  assert.equal(clearRows(board), 0);
});

for (const [lines, points] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
  test(`${lines}-line clear adds ${points} points before spawning`, () => {
    const board = createBoard();
    for (let y = BOARD_HEIGHT - lines; y < BOARD_HEIGHT; y++) {
      board[y].fill('J');
      board[y][4] = null;
    }
    const piece = { type: 'I', shape: [[1], [1], [1], [1]], x: 4, y: 0 };
    const stats = { score: 25 };
    assert.ok(hardDrop(board, piece, () => 0, stats));
    assert.equal(stats.score, 25 + points);
    assert.equal(occupied(board), 4 - lines);
  });
}

test('blocked spawn returns game over without overwriting the stack', () => {
  const board = createBoard();
  board[0][3] = 'Z'; // Blocks the next I piece.
  assert.equal(hardDrop(board, square(), () => 0), null);
  assert.equal(board[0][3], 'Z');
  assert.equal(occupied(board), 5);
});

test('all display states fit exactly 24 rows and rendering does not mutate state', () => {
  const board = createBoard();
  board[19][0] = 'J';
  const piece = square();
  const before = structuredClone(board);
  for (const [over, paused] of [[false, false], [true, false], [false, true]]) {
    const frame = render(board, 1234, over ? null : piece, over, paused);
    const rows = frame.split('\n');
    assert.equal(rows.length, 24);
    assert.match(rows[0], /Score: 1234/);
    assert.equal(rows.slice(2, 22).length, BOARD_HEIGHT);
    assert.ok(rows.slice(1, 23).every(row => row.length === 22));
    assert.match(rows[23], /Q: quit/);
    if (over) assert.match(rows[0], /GAME OVER.*R: restart/);
    if (paused) assert.match(rows[0], /PAUSED.*P: resume/);
  }
  assert.deepEqual(board, before);
  assert.deepEqual(piece, square());
  assert.match(render(board, 0, piece).split('\n')[2], /\[\]\[\]/);
});
