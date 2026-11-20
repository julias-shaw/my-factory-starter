'use strict';

const readline = require('node:readline');
const { renderGame } = require('./board');
const { TetrisGame } = require('./game');

/** Apply one decoded keypress and redraw only when the key is recognized. */
function handleKey(game, key, onUpdate, onQuit) {
  if (key.ctrl && key.name === 'c') {
    onQuit();
    return true;
  }

  switch (key.name) {
    case 'left':
      game.move(-1);
      break;
    case 'right':
      game.move(1);
      break;
    case 'down':
      game.softDrop();
      break;
    case 'up':
    case 'x':
      game.rotate(1);
      break;
    case 'z':
      game.rotate(-1);
      break;
    case 'space':
      game.hardDrop();
      break;
    case 'p':
      game.togglePause(onUpdate);
      break;
    case 'r':
      game.restart(onUpdate);
      break;
    case 'q':
      onQuit();
      return true;
    default:
      return false;
  }

  onUpdate();
  return true;
}

function main() {
  const game = new TetrisGame();
  const input = process.stdin;
  const output = process.stdout;
  const wasRaw = input.isRaw;
  let cleanedUp = false;

  function render() {
    if (output.isTTY) {
      output.write('\x1b[H\x1b[2J');
    }
    output.write(`${renderGame(game)}\n`);
  }

  function cleanup() {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    game.stop();
    input.removeListener('keypress', onKeypress);
    if (input.isTTY) {
      input.setRawMode(wasRaw);
    }
    input.pause();
    if (output.isTTY) {
      output.write('\x1b[?25h');
    }
  }

  function quit() {
    cleanup();
    if (output.isTTY) {
      output.write('\n');
    }
    process.exit(0);
  }

  function onKeypress(_text, key) {
    handleKey(game, key, render, quit);
  }

  readline.emitKeypressEvents(input);
  if (input.isTTY) {
    input.setRawMode(true);
    output.write('\x1b[?25l');
  }
  input.on('keypress', onKeypress);
  input.resume();
  process.once('exit', cleanup);

  render();
  game.start(render);
  return game;
}

if (require.main === module) {
  main();
}

module.exports = { handleKey, main };
