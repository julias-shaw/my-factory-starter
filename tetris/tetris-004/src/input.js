// Translate raw terminal key sequences into game actions.
const KEYMAP = new Map([
  ['\u001b[D', 'left'],
  ['\u001b[C', 'right'],
  ['\u001b[B', 'down'],
  ['\u001b[A', 'rotate'],
  ['\u001bOD', 'left'],
  ['\u001bOC', 'right'],
  ['\u001bOB', 'down'],
  ['\u001bOA', 'rotate'],
  ['a', 'left'],
  ['d', 'right'],
  ['s', 'down'],
  ['w', 'rotate'],
  [' ', 'drop'],
  ['p', 'pause'],
  ['r', 'restart'],
  ['q', 'quit'],
  ['\u0003', 'quit'], // Ctrl-C
  ['\u0004', 'quit'], // Ctrl-D
]);

// Scan an escape sequence starting at `start` (data[start] is ESC). Returns
// the index just past the sequence, or -1 if the data ends before the
// sequence is complete. CSI (ESC [) sequences run through any parameter
// (0x30-0x3F) and intermediate (0x20-0x2F) bytes up to a final byte
// (0x40-0x7E), so modified keys like ESC[1;5D are consumed whole. SS3
// (ESC O) sequences may carry digit/';' parameters before their final byte.
// Returns `start + 1` for an ESC that does not begin CSI or SS3.
function scanEscape(data, start) {
  const intro = data[start + 1];
  if (intro === undefined) return -1;
  if (intro !== '[' && intro !== 'O') return start + 1;
  let i = start + 2;
  while (i < data.length) {
    const code = data.charCodeAt(i);
    if (intro === '[') {
      if (code >= 0x20 && code <= 0x3f) { i += 1; continue; }
      if (code >= 0x40 && code <= 0x7e) return i + 1;
    } else {
      if ((code >= 0x30 && code <= 0x39) || code === 0x3b) { i += 1; continue; }
      if (code >= 0x40 && code <= 0x7e) return i + 1;
    }
    // Malformed sequence: drop what we have so its bytes are never read as
    // letters, and resume at the unexpected byte.
    return i;
  }
  return -1;
}

// Split buffered terminal input into key sequences. An incomplete escape
// sequence at the end is returned as `rest` so the next chunk can complete it.
export function splitKeys(data) {
  const keys = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] === '\u001b') {
      const end = scanEscape(data, i);
      if (end === -1) return { keys, rest: data.slice(i) };
      keys.push(data.slice(i, end));
      i = end;
      continue;
    }
    keys.push(data[i]);
    i += 1;
  }
  return { keys, rest: '' };
}

function toActions(keys) {
  return keys
    .map((key) => KEYMAP.get(key.length === 1 ? key.toLowerCase() : key))
    .filter(Boolean);
}

// Terminal data chunks can split an escape sequence anywhere, so keep any
// incomplete sequence between calls instead of reading its tail as letters.
export function createKeyParser() {
  let pending = '';
  return function feed(data) {
    const { keys, rest } = splitKeys(pending + String(data));
    pending = rest;
    return toActions(keys);
  };
}

// Stateless helper for a complete chunk of input.
export function parseKeys(data) {
  return toActions(splitKeys(String(data)).keys);
}
