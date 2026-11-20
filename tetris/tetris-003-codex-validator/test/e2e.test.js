// End-to-end checks: launch `npm start` in a real pseudo-terminal (via the
// util-linux `script` command), send keys, and inspect what was drawn.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const hasScript = spawnSync('script', ['--version']).status === 0;
const skip = hasScript ? false : 'util-linux `script` is not available';

const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

// Runs `npm start` in a cols x rows pty, writing each [delayMs, keys] step.
function play(cols, rows, steps) {
  return new Promise((resolve, reject) => {
    const child = spawn('script', ['-qfec', `stty rows ${rows} cols ${cols}; npm start --silent`, '/dev/null'], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => { out += d; });
    const killer = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(killer);
      resolve({ code, out });
    });
    let t = 0;
    for (const [delay, keys] of steps) {
      t += delay;
      setTimeout(() => child.stdin.write(keys), t);
    }
  });
}

// Splits output into frames (each begins by homing the cursor) of plain lines.
// The pty's output processing may turn "\r\n" into "\r\r\n".
function frames(out) {
  return out.split('\u001b[H').slice(1).map((f) => f.split(/\r*\n/).map((l) => l.replace(ANSI, '')));
}

test('npm start plays to game over, restarts, and quits cleanly in 80x24', { skip }, async () => {
  const { code, out } = await play(80, 24, [
    [1500, ' '.repeat(10)],
    [300, ' '.repeat(40)],
    [500, 'r'],
    [500, 'q'],
  ]);
  assert.equal(code, 0);
  assert.ok(out.includes('\u001b[?1049h'), 'enters the alternate screen');
  assert.ok(out.trimEnd().endsWith('\u001b[?1049l'), 'restores the terminal on quit');

  const all = frames(out);
  assert.ok(all.length > 0);
  for (const lines of all) {
    assert.ok(lines.length <= 24, `frame has ${lines.length} rows`);
    for (const line of lines) assert.ok(line.length <= 80, `line too wide: ${line}`);
  }
  const overIndex = all.findIndex((lines) => lines.includes('GAME OVER - press R to restart, Q to quit'));
  assert.ok(overIndex >= 0, 'game over message is shown');
  const over = all[overIndex];
  assert.equal(over.length, 24);
  assert.ok(over.some((l) => l.startsWith('+---')) && over.some((l) => l.includes('SCORE')));
  assert.ok(over.some((l) => l.startsWith('Arrows/WASD')), 'controls stay visible at game over');

  const afterRestart = all.slice(overIndex + 1).find((lines) => !lines.some((l) => l.includes('GAME OVER')));
  assert.ok(afterRestart, 'R starts a fresh game');
  assert.ok(afterRestart.some((l) => l.includes('SCORE')));
});

test('npm start in a too-small terminal pauses and asks for a resize', { skip }, async () => {
  const { code, out } = await play(40, 20, [[1200, 'q']]);
  assert.equal(code, 0);
  const all = frames(out);
  assert.ok(all.length > 0);
  for (const lines of all) {
    assert.ok(lines.length <= 20, `frame has ${lines.length} rows`);
    for (const line of lines) assert.ok(line.length <= 40, `line too wide: ${line}`);
  }
  assert.ok(out.includes('Terminal too small'));
  assert.match(out, /Need \d+x24, have 40x20/);
});
