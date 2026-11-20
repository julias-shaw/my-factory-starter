import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('stdin EOF exits cleanly and restores the terminal', async (t) => {
  const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
  const child = spawn(process.execPath, [entry], {
    stdio: ['pipe', 'pipe', 'pipe'],
    signal: AbortSignal.timeout(2000),
  });
  t.after(() => child.kill());
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (text) => { output += text; });

  child.stdin.end();
  const [code, signal] = await once(child, 'close');

  assert.equal(code, 0);
  assert.equal(signal, null);
  assert.ok(output.includes('\u001b[?1049h'), 'entered alternate screen');
  assert.ok(output.includes('\u001b[?1049l'), 'restored original screen');
  assert.ok(output.includes('\u001b[?25h'), 'restored cursor visibility');
});
