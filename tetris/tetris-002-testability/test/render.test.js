'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createBoard, createPiece, generateFrame } = require('../index');

function makeState(overrides = {}) {
  return {
    board: createBoard(),
    piece: createPiece('O'),
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    ...overrides,
  };
}

test('generateFrame shows the score, lines, and level', () => {
  const frame = generateFrame(makeState({ score: 1230, lines: 5, level: 2 }));
  const rows = frame.split('\n');
  assert.equal(rows.length, 24);
  assert.match(frame, /Score:\s*1230/);
  assert.match(frame, /Lines:\s*5/);
  assert.match(frame, /Level:\s*2/);
});

test('generateFrame shows the controls', () => {
  const frame = generateFrame(makeState());
  assert.match(frame, /left\s+- move/);
  assert.match(frame, /down\s+- move/);
  assert.match(frame, /right\s+- move/);
  assert.match(frame, /space\s+- rotate/);
  assert.match(frame, /q\s+- quit/);
});

test('generateFrame stays within 24 rows', () => {
  const rows = generateFrame(makeState()).split('\n');
  assert.equal(rows.length, 24);
  assert.ok(rows.every(row => row.length <= 80));
});

test('generateFrame shows a game-over message', () => {
  const frame = generateFrame(makeState({ gameOver: true }));
  assert.match(frame, /GAME OVER/);
});
