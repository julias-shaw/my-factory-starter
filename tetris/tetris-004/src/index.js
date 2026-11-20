import { createTerminal } from './terminal.js';
import { createKeyParser } from './input.js';
import { createGame, gravityInterval } from './game.js';

const terminal = createTerminal();
let exiting = false;
const parseKeys = createKeyParser();
const game = createGame();
let gravityTimer = null;

const ACTIONS = {
  left: () => game.moveLeft(),
  right: () => game.moveRight(),
  down: () => game.softDrop(),
  rotate: () => game.rotate(),
  drop: () => game.hardDrop(),
  pause: () => game.togglePause(),
  restart: () => game.restart(),
};

// Placeholder text view; the full board renderer replaces this.
function render() {
  const status = game.gameOver ? 'GAME OVER - r to restart' : game.paused ? 'PAUSED' : 'Playing';
  terminal.draw(
    [
      'TETRIS',
      '',
      `Score: ${game.score}  Lines: ${game.lines}  Level: ${game.level}`.padEnd(40),
      `Piece: ${game.current.type}  Next: ${game.next}`.padEnd(40),
      status.padEnd(40),
      '',
      'Press q or Ctrl-C to quit.',
    ].join('\n'),
  );
}

// Re-arm gravity after each step so the interval follows the current level.
function scheduleGravity() {
  clearTimeout(gravityTimer);
  gravityTimer = setTimeout(() => {
    game.tick();
    render();
    scheduleGravity();
  }, gravityInterval(game.level));
}

function exit(code = 0) {
  if (exiting) return;
  exiting = true;
  clearTimeout(gravityTimer);
  terminal.stop();
  process.exit(code);
}

function handleInput(data) {
  for (const action of parseKeys(data)) {
    if (action === 'quit') return exit(0);
    ACTIONS[action]?.();
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
scheduleGravity();
