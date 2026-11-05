/** Owns the replay boundary. A failed or active replay is never readable. */
export function createWorker({ sync, intervalSeconds = 60, staleAfterSeconds = Math.max(120, intervalSeconds * 3), now = () => new Date() }) {
  const state = { running: false, failed: false, generation: 0, lastSuccess: null, snapshotUpperId: null };
  let stopped = true;
  let timer;
  let current;

  function freshness() {
    const lag = state.lastSuccess ? Math.max(0, Math.floor((now().valueOf() - state.lastSuccess.valueOf()) / 1000)) : null;
    return { status: state.running || state.failed || !state.lastSuccess ? 'unavailable' : lag > staleAfterSeconds ? 'stale' : 'ready',
      last_synced_at: state.lastSuccess?.toISOString() ?? null, lag_seconds: lag };
  }

  function run() {
    if (current) return current;
    state.running = true;
    state.generation++;
    current = (async () => {
      try {
        // Defer invocation so even a synchronous failure clears the assigned run.
        const result = await Promise.resolve().then(sync);
        if (!Number.isSafeInteger(result.snapshotUpperId) || result.snapshotUpperId < 0) throw new Error('Invalid replay boundary');
        state.snapshotUpperId = result.snapshotUpperId;
        state.lastSuccess = now();
        state.failed = false;
        return true;
      } catch {
        state.failed = true;
        return false;
      } finally {
        state.running = false;
        state.generation++;
        current = null;
      }
    })();
    return current;
  }

  async function cycle() {
    await run();
    if (!stopped) timer = setTimeout(cycle, intervalSeconds * 1000);
  }

  return { state, freshness, run,
    start() { if (!stopped) return; stopped = false; void cycle(); },
    async stop() { stopped = true; clearTimeout(timer); await current; } };
}
