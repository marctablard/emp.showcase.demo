#!/usr/bin/env node
/**
 * Cross-platform dev helper: waits for the local Next.js health endpoint,
 * then opens the app in the default browser.
 *
 * Respects the PORT environment variable (defaults to 3000) so it stays in
 * sync with `next dev -p <port>` / a custom PORT. Spawns the locally installed
 * `wait-on` and `open-cli` binaries (available on PATH when run via npm), which
 * avoids importing those packages directly and works on macOS, Linux, and
 * Windows.
 */
import { spawn } from 'node:child_process';

const port = process.env.PORT || '3000';
const healthUrl = `http://localhost:${port}/api/health`;
const appUrl = `http://localhost:${port}`;

const isWindows = process.platform === 'win32';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: isWindows,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

try {
  await run('wait-on', [healthUrl]);
  await run('open-cli', [appUrl]);
} catch (error) {
  console.error(`[dev:open-browser] ${error.message}`);
  process.exit(1);
}
