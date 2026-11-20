// Terminal setup and teardown: raw input, alternate screen, hidden cursor.
const ESC = '\u001b[';

export function createTerminal({ input = process.stdin, output = process.stdout } = {}) {
  let active = false;
  let onData = null;

  function start(handler) {
    if (active) return;
    active = true;
    onData = (data) => handler(data);
    if (input.isTTY) input.setRawMode(true);
    input.setEncoding('utf8');
    input.on('data', onData);
    input.resume();
    output.write(`${ESC}?1049h${ESC}?25l${ESC}2J${ESC}H`);
  }

  function stop() {
    if (!active) return;
    active = false;
    if (onData) input.off('data', onData);
    if (input.isTTY) input.setRawMode(false);
    input.pause();
    output.write(`${ESC}0m${ESC}?25h${ESC}?1049l`);
  }

  // Draw from the top-left, clearing the rest of each line and everything
  // below so stale content never lingers. Accepts lines or a single string.
  function draw(lines) {
    const rows = Array.isArray(lines) ? lines : String(lines).split('\n');
    output.write(`${ESC}H${rows.join(`${ESC}K\r\n`)}${ESC}K${ESC}J`);
  }

  function clear() {
    output.write(`${ESC}2J${ESC}H`);
  }

  return { start, stop, draw, clear };
}
