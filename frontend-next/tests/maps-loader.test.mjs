import assert from "node:assert/strict";
import { loadMapsSdk } from "../lib/maps-loader.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fakeDocument() {
  const scripts = new Map();
  const head = { appendChild(script) { scripts.set(script.id, script); script.parentNode = head; }, removeChild(script) { scripts.delete(script.id); script.parentNode = null; } };
  return {
    scripts,
    head,
    getElementById(id) { return scripts.get(id) || null; },
    createElement() {
      const listeners = new Map();
      return {
        addEventListener(type, fn) { listeners.set(type, fn); },
        removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
        dispatch(type) { listeners.get(type)?.(); },
        parentNode: null,
      };
    },
  };
}
const response = (value) => ({ ok: true, json: async () => value });

{
  const doc = fakeDocument(); const errors = [];
  loadMapsSdk({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }), documentRef: doc, google: {}, onReady() {}, onUnavailable: (e) => errors.push(e) });
  await tick();
  assert.deepEqual(errors, ["Map configuration is unavailable."]);
}
{
  const doc = fakeDocument(); const errors = [];
  loadMapsSdk({ fetchImpl: async () => response({}), documentRef: doc, google: {}, onReady() {}, onUnavailable: (e) => errors.push(e) });
  await tick();
  assert.deepEqual(errors, ["No Google Maps browser key is configured."]);
}
{
  const doc = fakeDocument(); const errors = []; let ready = 0;
  const cleanup = loadMapsSdk({ fetchImpl: async () => response({ browser_key: "test" }), documentRef: doc, google: {}, onReady: () => ready++, onUnavailable: (e) => errors.push(e) });
  await tick();
  const script = doc.scripts.get("mobility-google-maps-sdk");
  script.dispatch("error");
  assert.equal(ready, 0);
  assert.match(errors[0], /Google Maps could not load/);
  assert.equal(doc.scripts.has("mobility-google-maps-sdk"), false);
  cleanup();
}
{
  const doc = fakeDocument(); let ready = 0;
  const cleanup = loadMapsSdk({ fetchImpl: async () => response({ browser_key: "test" }), documentRef: doc, google: {}, onReady: () => ready++, onUnavailable() {} });
  cleanup();
  await tick();
  assert.equal(ready, 0, "late SDK callbacks must not update an unmounted session");
}
console.log("maps loader failure and cleanup assertions passed");
