import { execFile, spawn } from 'child_process';
import * as http from 'http';

const portEnv = process.env.PORT || '3000';
const parsedPort = parseInt(portEnv, 10);
const PORT = Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 3000 : parsedPort;
const URL = `http://localhost:${PORT}`;
/** Poll liveness so Node's minimal `http.get` headers do not hit `/` (middleware health-check shortcut). */
const HEALTH_URL = `${URL}/api/health`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000;

export function openBrowser(url: string): void {
  const platform = process.platform;
  const cb = (error: Error | null) => {
    if (error) {
      console.log(`\x1b[33m⚠ Could not open browser automatically. Please visit: ${url}\x1b[0m`);
    } else {
      console.log(`\x1b[32m✓ Browser opened at ${url}\x1b[0m`);
    }
  };

  switch (platform) {
    case 'darwin':
      // macOS: 'open' command opens URL in default browser and focuses it
      execFile('open', [url], cb);
      break;
    case 'win32':
      // Windows: 'start' command via cmd to open URL in default browser
      {
        let fired = false;
        const child = spawn('cmd', ['/c', 'start', '""', url], { windowsVerbatimArguments: true, detached: true });
        child.on('error', (err) => {
          if (!fired) { fired = true; cb(err); }
        });
        child.on('spawn', () => {
          if (!fired) { fired = true; cb(null); }
        }); // Success when it spawns
        child.unref();
      }
      break;
    default:
      // Linux and others: try xdg-open
      execFile('xdg-open', [url], cb);
  }
}

function checkServer(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServerAndOpen(): Promise<void> {
  console.log(`\x1b[36m⏳ Waiting for dev server at ${URL}...\x1b[0m`);

  for (let i = 0; i < MAX_RETRIES; i++) {
    const isReady = await checkServer(HEALTH_URL);

    if (isReady) {
      // Small additional delay to ensure the server is fully ready
      await new Promise((resolve) => setTimeout(resolve, 500));
      openBrowser(URL);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
  }

  console.log(`\x1b[33m⚠ Server didn't respond after ${MAX_RETRIES} attempts. Please open ${URL} manually.\x1b[0m`);
}

if (require.main === module) {
  waitForServerAndOpen();
}


