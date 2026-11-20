import { createTerminal } from './terminal.js';
import { createKeyParser } from './input.js';

const terminal = createTerminal();
let exiting = false;
let lastAction = 'none';
const parseKeys = createKeyParser();

function render() {
  terminal.draw(
    [
      'TETRIS',
      '',
      `Last key: ${lastAction}`.padEnd(30),
      '',
      'Press q or Ctrl-C to quit.',
    ].join('\n'),
  );
}

function exit(code = 0) {
  if (exiting) return;
  exiting = true;
  terminal.stop();
  process.exit(code);
}

function handleInput(data) {
  for (const action of parseKeys(data)) {
    if (action === 'quit') return exit(0);
    lastAction = action;
  }
  render();
}

process.on('SIGINT', () => exit(0));
process.on('SIGTERM', () => exit(0));
process.on('uncaughtException', (err) => {
  terminal.stop();
  console.error(err);
  process.exit(1);
});

terminal.start(handleInput);
render();
