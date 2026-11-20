import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { parseKeys } from '../src/input.js';
import { MAX_ROWS, layoutSize, render, visibleText } from '../src/render.js';

const states = () => {
  const playing = new Game({ random: () => 0.3 });
  const paused = new Game({ random: () => 0.3 });
  paused.togglePause();
  const over = new Game({ random: () => 0.3 });
  while (!over.gameOver) over.hardDrop();
  return { playing, paused, over };
};

test('every display state fits within 24 rows and the layout width', () => {
  for (const [name, game] of Object.entries(states())) {
    for (const color of [true, false]) {
      const lines = render(game, { columns: 80, rows: 24, color });
      assert.ok(lines.length <= MAX_ROWS, `${name} uses ${lines.length} rows`);
      for (const line of lines) {
        assert.ok([...visibleText(line)].length <= layoutSize(game).width, `${name}: ${line}`);
      }
    }
  }
});

test('game over and pause messages are shown', () => {
  const { paused, over } = states();
  assert.match(render(over, { color: false }).join('\n'), /GAME OVER/);
  assert.match(render(over, { color: false }).join('\n'), /restart/);
  assert.match(render(paused, { color: false }).join('\n'), /PAUSED/);
});

test('display never exceeds 24 rows even on a taller terminal', () => {
  const lines = render(new Game(), { columns: 200, rows: 60 });
  assert.ok(lines.length <= MAX_ROWS);
});

test('small terminals get a resize hint instead of a broken board', () => {
  const lines = render(new Game(), { columns: 20, rows: 10, color: false });
  assert.match(lines[0], /too small/);
  assert.ok(lines.length <= 10);
});

test('parseKeys maps arrows, letters and multi-key chunks', () => {
  assert.deepEqual(parseKeys('\u001b[A\u001b[B\u001b[C\u001b[D'), [
    'rotateClockwise',
    'softDrop',
    'moveRight',
    'moveLeft',
  ]);
  assert.deepEqual(parseKeys(' zPRq'), ['hardDrop', 'rotateCounterClockwise', 'pause', 'restart', 'quit']);
  assert.deepEqual(parseKeys('\u0003'), ['quit']);
  assert.deepEqual(parseKeys('\u001b'), ['quit']);
});
