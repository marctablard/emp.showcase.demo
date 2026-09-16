#!/usr/bin/env node
/**
 * `prepare` hook: install husky git hooks only inside a real worktree.
 * Vercel / disposable CI dirs have no `.git`; husky 9 would print
 * `.git can't be found` (exit 0) and look like a deploy failure. Skip instead.
 */
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const { delimiter, join } = require('path');

if (process.env.HUSKY === '0' || !existsSync('.git')) {
  process.exit(0);
}

const huskyBin = join(__dirname, '..', 'node_modules', 'husky', 'bin.js');
const result = spawnSync(process.execPath, [huskyBin], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${join(__dirname, '..', 'node_modules', '.bin')}${delimiter}${process.env.PATH || ''}`,
  },
});
process.exit(result.status ?? 1);
