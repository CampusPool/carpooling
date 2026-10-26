#!/usr/bin/env node

import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const healthTimeoutMs = 60_000;
const raceTrials = process.env.RACE_TRIALS ?? '12';
const cancelRaceTrials = process.env.CANCEL_RACE_TRIALS ?? '6';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not determine the temporary HTTP port')));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function commandFor(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function logChild(label, stream) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    for (const line of chunk.split(/\r?\n/)) if (line) process.stdout.write(`[${label}] ${line}\n`);
  });
}

function stopProcess(child, label) {
  if (!child) return Promise.resolve();
  const ended = child.exitCode !== null || child.signalCode !== null;
  if (ended) {
    // The npm/npx wrapper may have exited while a descendant is still alive.
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
    } catch { /* process group is already gone */ }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(forceTimer);
      resolve();
    };
    child.once('close', done);
    const forceTimer = setTimeout(() => {
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch { /* already gone */ }
      done();
    }, 5_000);
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else if (child.pid) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch { done(); }
    process.stdout.write(`[http-harness] stopping ${label}\n`);
  });
}

async function waitForHealth(child, origin) {
  const deadline = Date.now() + healthTimeoutMs;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Next server exited before health check (code=${child.exitCode}, signal=${child.signalCode})`);
    }
    try {
      const response = await fetch(`${origin}/api/auth/me`, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) {
        process.stdout.write(`[http-harness] server healthy at ${origin} (HTTP ${response.status})\n`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become healthy within ${healthTimeoutMs / 1000}s (${lastError})`);
}

async function main() {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const environment = {
    ...process.env,
    APP_ORIGIN: origin,
    BASE_URL: origin,
    CP_BASE_URL: origin,
    RUN_CAMPUSPOOL_E2E: '1',
    RUN_CAMPUSPOOL_RACES: '1',
    RACE_TRIALS: raceTrials,
    CANCEL_RACE_TRIALS: cancelRaceTrials,
  };
  let server;
  let tests;
  try {
    server = spawn(commandFor('npm'), ['start', '--', '-p', String(port)], {
      cwd: projectRoot,
      env: environment,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    logChild('next', server.stdout);
    logChild('next', server.stderr);
    await waitForHealth(server, origin);

    tests = spawn(commandFor('npx'), ['vitest', 'run', 'tests/http.e2e.test.ts'], {
      cwd: projectRoot,
      env: environment,
      detached: process.platform !== 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    logChild('vitest', tests.stdout);
    logChild('vitest', tests.stderr);
    const exitCode = await new Promise((resolve, reject) => {
      tests.once('error', reject);
      tests.once('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    if (exitCode !== 0) throw new Error(`HTTP E2E suite failed with exit code ${exitCode}`);
    process.stdout.write('[http-harness] HTTP E2E suite passed\n');
  } finally {
    await stopProcess(tests, 'Vitest');
    await stopProcess(server, 'Next');
  }
}

main().catch((error) => {
  console.error(`[http-harness] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
