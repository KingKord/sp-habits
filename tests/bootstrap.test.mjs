import test from "node:test";
import assert from "node:assert/strict";
import { bootApplication } from "../src/bootstrap.js";

function harness(withAPI = true) {
  let ready, unload, hidden;
  let created = 0,
    started = 0,
    disposed = 0;
  const window = {
    document: { body: { hidden: true } },
    addEventListener: (_type, handler) => {
      hidden = handler;
    },
    removeEventListener: (_type, handler) => {
      if (hidden === handler) hidden = null;
    }
  };
  if (withAPI)
    window.PluginAPI = {
      onReady: (handler) => {
        ready = handler;
      },
      onUnload: (handler) => {
        unload = handler;
      }
    };
  const boot = bootApplication(
    window,
    (options) => {
      assert.equal(options.window, window);
      assert.equal(options.api, window.PluginAPI);
      created++;
      return {
        start: async () => {
          started++;
        },
        dispose: () => {
          disposed++;
        }
      };
    },
    async () => {}
  );
  return {
    boot,
    ready: () => ready(),
    unload: () => unload(),
    hide: () => hidden?.(),
    counts: () => ({ created, started, disposed }),
    get listening() {
      return !!hidden;
    }
  };
}

test("repeated host readiness initializes one app; unload and pagehide clean it up once", async () => {
  const h = harness();
  assert.deepEqual(h.counts(), { created: 0, started: 0, disposed: 0 });
  await Promise.all([h.ready(), h.ready()]);
  assert.deepEqual(h.counts(), { created: 1, started: 1, disposed: 0 });
  h.hide();
  h.unload();
  h.boot.dispose();
  h.ready();
  assert.deepEqual(h.counts(), { created: 1, started: 1, disposed: 1 });
  assert.equal(h.listening, false);
});

test("a delayed readiness callback after unload cannot resurrect the app", async () => {
  const h = harness();
  h.unload();
  await h.ready();
  assert.deepEqual(h.counts(), { created: 0, started: 0, disposed: 0 });
});

test("without host readiness the app starts after locale setup and can display the missing API error", async () => {
  const h = harness(false);
  await Promise.resolve();
  assert.deepEqual(h.counts(), { created: 1, started: 1, disposed: 0 });
  h.boot.dispose();
  assert.equal(h.counts().disposed, 1);
});

test("unloading during asynchronous language setup cannot create an app or lose a second readiness guard", async () => {
  let finish, ready, hidden;
  let created = 0;
  const window = {
    PluginAPI: {
      onReady: (fn) => {
        ready = fn;
      }
    },
    document: { body: { hidden: true } },
    addEventListener: (_type, fn) => {
      hidden = fn;
    },
    removeEventListener: () => {}
  };
  const boot = bootApplication(
    window,
    () => {
      created++;
    },
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const starting = ready();
  await ready();
  hidden();
  finish();
  await starting;
  assert.equal(created, 0);
  assert.equal(window.document.body.hidden, true);
  boot.dispose();
});
