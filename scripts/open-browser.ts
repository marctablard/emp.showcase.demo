import { exec } from 'child_process';
import * as http from 'http';

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000;

function openBrowser(url: string): void {
  const platform = process.platform;

  let command: string;
  switch (platform) {
    case 'darwin':
      // macOS: 'open' command opens URL in default browser and focuses it
      command = `open "${url}"`;
      break;
    case 'win32':
      // Windows: 'start' command opens URL in default browser
      command = `start "" "${url}"`;
      break;
    default:
      // Linux and others: try xdg-open
      command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log(`\x1b[33m⚠ Could not open browser automatically. Please visit: ${url}\x1b[0m`);
    } else {
      console.log(`\x1b[32m✓ Browser opened at ${url}\x1b[0m`);
    }
  });
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
    const isReady = await checkServer(URL);

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

waitForServerAndOpen();


