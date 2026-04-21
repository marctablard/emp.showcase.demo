#!/usr/bin/env node
/**
 * Jest launcher:
 * - Strip invalid `--localstorage-file` / `--experimental-webstorage` noise from env and execArgv.
 * - Force `--no-experimental-webstorage` on the Jest process and workers: Jest's `jest-environment-node`
 *   teardown touches `global.localStorage` (see jest-util `deleteProperties`), which triggers Node's
 *   experimental Web Storage warning unless this flag is set (Node 22+).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jestCli = require.resolve('jest/bin/jest');

function stripLocalstorageNoise(argv) {
  return argv.filter(
    (a) => !String(a).includes('localstorage-file') && !String(a).startsWith('--experimental-webstorage'),
  );
}

function stripNodeOptions(raw) {
  if (!raw) return undefined;
  const parts = raw.split(/\s+/).filter(Boolean);
  const next = stripLocalstorageNoise(parts);
  return next.length ? next.join(' ') : undefined;
}

const DISABLE_WEBSTORAGE = '--no-experimental-webstorage';

const env = { ...process.env };
const nextOpts = stripNodeOptions(env.NODE_OPTIONS);
const nodeOptParts = [];
if (nextOpts) {
  nodeOptParts.push(...nextOpts.split(/\s+/).filter(Boolean));
}
if (!nodeOptParts.includes(DISABLE_WEBSTORAGE)) {
  nodeOptParts.push(DISABLE_WEBSTORAGE);
}
// NODE_OPTIONS is inherited by Jest worker processes; execArgv alone does not reliably propagate.
env.NODE_OPTIONS = nodeOptParts.join(' ');

const childExecArgv = stripLocalstorageNoise(process.execArgv);
if (!childExecArgv.some((a) => a === DISABLE_WEBSTORAGE)) {
  childExecArgv.push(DISABLE_WEBSTORAGE);
}

const jestArgs = process.argv.slice(2);

const result = spawnSync(process.execPath, [jestCli, ...jestArgs], {
  cwd: root,
  stdio: 'inherit',
  env,
  execArgv: childExecArgv,
});

if (result.signal) {
  process.kill(process.pid, result.signal);
}
process.exit(result.status === null ? 1 : result.status);
