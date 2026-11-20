// Translates raw terminal keypresses into game actions.

const KEY_ACTIONS = new Map([
  ['\u001b[D', 'left'],
  ['\u001b[C', 'right'],
  ['\u001b[B', 'softDrop'],
  ['\u001b[A', 'rotate'],
  ['a', 'left'],
  ['d', 'right'],
  ['s', 'softDrop'],
  ['w', 'rotate'],
  [' ', 'hardDrop'],
  ['p', 'pause'],
  ['r', 'restart'],
  ['q', 'quit'],
  ['\u0003', 'quit'], // Ctrl+C
]);

// Splits a chunk of input (which may contain several keys) into actions.
export function parseKeys(chunk) {
  const actions = [];
  let i = 0;
  while (i < chunk.length) {
    if (chunk[i] === '\u001b' && chunk[i + 1] === '[' && i + 2 < chunk.length) {
      const action = KEY_ACTIONS.get(chunk.slice(i, i + 3));
      if (action) actions.push(action);
      i += 3;
      continue;
    }
    const action = KEY_ACTIONS.get(chunk[i].toLowerCase());
    if (action) actions.push(action);
    i += 1;
  }
  return actions;
}

// Splits off a trailing, not-yet-complete escape sequence ("\u001b" or
// "\u001b[") so it can be joined with the next data event.
export function splitPending(chunk) {
  if (chunk.endsWith('\u001b')) return [chunk.slice(0, -1), '\u001b'];
  if (chunk.endsWith('\u001b[')) return [chunk.slice(0, -2), '\u001b['];
  return [chunk, ''];
}

// Puts stdin into raw mode and calls onAction for each recognized key.
// Returns a function that restores the terminal input state.
export function startInput(stdin, onAction) {
  const wasRaw = Boolean(stdin.isRaw);
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  let pending = '';
  const listener = (chunk) => {
    const [complete, rest] = splitPending(pending + String(chunk));
    pending = rest;
    for (const action of parseKeys(complete)) onAction(action);
  };
  stdin.on('data', listener);
  stdin.resume();
  return () => {
    stdin.off('data', listener);
    if (stdin.isTTY) stdin.setRawMode(wasRaw);
    stdin.pause();
  };
}
