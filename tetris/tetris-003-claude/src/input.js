// Keyboard input: turns raw terminal data into game actions.

const SEQUENCES = {
  '\u001b[A': 'rotateClockwise', // up arrow
  '\u001b[B': 'softDrop', // down arrow
  '\u001b[C': 'moveRight', // right arrow
  '\u001b[D': 'moveLeft', // left arrow
  '\u001bOA': 'rotateClockwise',
  '\u001bOB': 'softDrop',
  '\u001bOC': 'moveRight',
  '\u001bOD': 'moveLeft',
};

const KEYS = {
  a: 'moveLeft',
  h: 'moveLeft',
  d: 'moveRight',
  l: 'moveRight',
  s: 'softDrop',
  j: 'softDrop',
  w: 'rotateClockwise',
  x: 'rotateClockwise',
  k: 'rotateClockwise',
  z: 'rotateCounterClockwise',
  ' ': 'hardDrop',
  p: 'pause',
  r: 'restart',
  q: 'quit',
  '\u0003': 'quit', // Ctrl+C
  '\u001b': 'quit', // bare Esc
};

// Split a chunk of terminal input into actions. A single chunk may hold
// several keypresses (e.g. when keys repeat quickly).
export function parseKeys(data) {
  const actions = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] === '\u001b' && i + 2 < data.length && (data[i + 1] === '[' || data[i + 1] === 'O')) {
      const seq = data.slice(i, i + 3);
      if (SEQUENCES[seq]) actions.push(SEQUENCES[seq]);
      i += 3;
      continue;
    }
    const action = KEYS[data[i].toLowerCase()];
    if (action) actions.push(action);
    i += 1;
  }
  return actions;
}

// Apply an action to the game. Returns 'quit' when the player wants to exit.
export function applyAction(game, action) {
  switch (action) {
    case 'moveLeft':
      game.moveLeft();
      break;
    case 'moveRight':
      game.moveRight();
      break;
    case 'softDrop':
      game.softDrop();
      break;
    case 'rotateClockwise':
      game.rotateClockwise();
      break;
    case 'rotateCounterClockwise':
      game.rotateCounterClockwise();
      break;
    case 'hardDrop':
      game.hardDrop();
      break;
    case 'pause':
      game.togglePause();
      break;
    case 'restart':
      game.reset();
      break;
    case 'quit':
      return 'quit';
    default:
      break;
  }
  return null;
}
