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

  function draw(text) {
    output.write(`${ESC}H${text}${ESC}J`);
  }

  return { start, stop, draw };
}
