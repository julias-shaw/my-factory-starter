// A fixed-rate game loop. Calls update(dtMs) then render() on each tick.

export function createLoop({ update, render, intervalMs = 16, now = () => Date.now() }) {
  let timer = null;
  let lastTime = 0;

  function tick() {
    const t = now();
    const dt = t - lastTime;
    lastTime = t;
    update(dt);
    render();
  }

  return {
    start() {
      if (timer) return;
      lastTime = now();
      render();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    get running() {
      return timer !== null;
    },
    tick,
  };
}
