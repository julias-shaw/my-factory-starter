#!/usr/bin/env node
// Entry point for terminal Tetris. Launched via `npm start`.

export function main({ stdin = process.stdin, stdout = process.stdout } = {}) {
  if (!stdin.isTTY || !stdout.isTTY) {
    stdout.write('Terminal Tetris requires an interactive terminal (TTY).\n');
    process.exitCode = 1;
    return;
  }

  stdout.write('Terminal Tetris\nPress q to quit.\n');

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const quit = () => {
    stdin.setRawMode(false);
    stdin.pause();
    stdin.removeListener('data', onData);
  };

  function onData(key) {
    // q, Q, Ctrl+C, Esc
    if (key === 'q' || key === 'Q' || key === '\u0003' || key === '\u001b') {
      quit();
    }
  }

  stdin.on('data', onData);
}

main();
