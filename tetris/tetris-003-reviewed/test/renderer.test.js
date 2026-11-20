import test from 'node:test';
import assert from 'node:assert/strict';

import { TetrisGame } from '../src/game.js';
import { DISPLAY_ROWS, renderGame, renderLines } from '../src/renderer.js';

function createGame() {
  return new TetrisGame({ random: () => 0 });
}

function assertStandardDimensions(lines) {
  assert.equal(lines.length, DISPLAY_ROWS);
  assert.equal(lines.length, 24);
  assert.equal(lines[0], '+--------------------+');
  assert.equal(lines[21], '+--------------------+');
  for (const line of [lines[0], ...lines.slice(1, 21), lines[21]]) {
    assert.equal(line.length, 22);
  }
}

test('playing, game-over, and quit screens all fit exactly 24 rows', () => {
  const game = createGame();

  for (const status of ['playing', 'game-over', 'quit']) {
    game.status = status;
    const lines = renderLines(game, { color: false });
    assertStandardDimensions(lines);
    assert.equal(renderGame(game, { color: false }).split('\n').length, DISPLAY_ROWS);
    assert.match(lines[22], /^Score: 0  Lines: 0  Level: 1  Next: [IJLOSTZ]$/);
    if (status === 'game-over') assert.match(lines[23], /GAME OVER!/);
    if (status === 'quit') assert.match(lines[23], /Game quit\./);
    if (status === 'playing') assert.match(lines[23], /Arrows\/WASD move/);
  }
});

test('plain rendering shows board cells and borders without escape sequences', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 4, y: 0 };
  const lines = renderLines(game, { color: false });

  assertStandardDimensions(lines);
  assert.equal(lines[1], '|        [][]        |');
  assert.ok(lines.slice(1, 21).every((line) => line.startsWith('|') && line.endsWith('|')));
  assert.ok(lines.every((line) => !line.includes('\x1b')));
});

test('colored blocks do not change the number of rendered rows', () => {
  const game = createGame();
  const lines = renderLines(game, { color: true });

  assert.equal(lines.length, DISPLAY_ROWS);
  assert.ok(lines.slice(1, 21).some((line) => line.includes('\x1b[')));
  assert.equal(lines[22].includes('\x1b'), false);
  assert.equal(lines[23].includes('\x1b'), false);
});
