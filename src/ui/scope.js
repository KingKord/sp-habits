// A single owner for persistent listeners and timers, including application teardown.
export function createScope() {
  let disposed = false;
  const cleanups = [];

  function add(cleanup) {
    if (disposed) cleanup();
    else cleanups.push(cleanup);
  }

  function on(target, type, handler) {
    if (disposed) return;
    target.addEventListener(type, handler);
    add(() => target.removeEventListener(type, handler));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  }

  return {
    add,
    on,
    dispose,
    get disposed() {
      return disposed;
    }
  };
}
