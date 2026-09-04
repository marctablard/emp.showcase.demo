#!/usr/bin/env node
/**
 * Local SonarQube scan that matches `.github/workflows/sonarqube-scan.yml` on
 * `pull_request` (new-code quality gate vs the PR base, normally `develop`).
 *
 * The GitHub Action still indexes the whole checkout. This local entrypoint
 * keeps the same host, project key, `sonar-project.properties` split, and
 * `sonar.pullrequest.*` parameters, but limits `sonar.inclusions` /
 * `sonar.test.inclusions` to files changed vs that base (plus the working
 * tree) so the JS/TS analyzer does not walk the entire repo or `figma/`.
 *
 * Do not treat `npx sonarqube-scanner` as equivalent to the pinned
 * `sonarsource/sonarqube-scan-action` SHA in the workflow.
 */
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HOST = 'https://sonarqube.k8s-tech.emporix.io';
const DEFAULT_PROJECT_KEY = 'emporix-showcase';
const DEFAULT_BASE = 'develop';
const EMPTY_INCLUSION = '**/.sonar-pr-scan-empty';

const SKIP_PREFIXES = ['node_modules/', '.next/', 'coverage/', 'figma/', '.scannerwork/', '.git/'];
const SKIP_EXTENSIONS = new Set([
  '.fig',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.mp4',
  '.webm',
]);

function toPosix(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function isSkippedPath(relPath) {
  const rel = toPosix(relPath);
  if (SKIP_PREFIXES.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix))) {
    return true;
  }
  return SKIP_EXTENSIONS.has(path.posix.extname(rel).toLowerCase());
}

function isSonarTestFile(relPath) {
  const rel = toPosix(relPath);
  if (rel === 'e2e' || rel.startsWith('e2e/')) {
    return true;
  }
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel);
}

function classifyChangedFiles(relPaths) {
  const sources = [];
  const tests = [];
  const seen = new Set();
  for (const raw of relPaths) {
    const rel = toPosix(raw).replace(/^\.\//, '');
    if (!rel || seen.has(rel) || isSkippedPath(rel)) {
      continue;
    }
    seen.add(rel);
    if (isSonarTestFile(rel)) {
      tests.push(rel);
    } else {
      sources.push(rel);
    }
  }
  return { sources, tests };
}

function mergeChangedPaths(...groups) {
  return [...new Set(groups.flat().map((filePath) => toPosix(filePath).replace(/^\.\//, '')).filter(Boolean))];
}

function githubRepositoryFromRemote(remoteUrl) {
  if (!remoteUrl) {
    return undefined;
  }
  const match = String(remoteUrl)
    .trim()
    .replace(/\.git$/, '')
    .match(/github\.com[:/]([^/]+\/[^/]+)$/i);
  return match ? match[1] : undefined;
}

function inclusionProperty(paths) {
  return paths.length > 0 ? paths.join(',') : EMPTY_INCLUSION;
}

function buildScannerArgs({ projectKey, pullRequest, repository, sources, tests, waitForQualityGate = true }) {
  const args = [`-Dsonar.projectKey=${projectKey}`];
  if (pullRequest) {
    args.push(`-Dsonar.pullrequest.key=${pullRequest.key}`);
    args.push(`-Dsonar.pullrequest.branch=${pullRequest.branch}`);
    args.push(`-Dsonar.pullrequest.base=${pullRequest.base}`);
    args.push('-Dsonar.pullrequest.provider=github');
    if (repository) {
      args.push(`-Dsonar.pullrequest.github.repository=${repository}`);
    }
  }
  args.push(`-Dsonar.inclusions=${inclusionProperty(sources)}`);
  args.push(`-Dsonar.test.inclusions=${inclusionProperty(tests)}`);
  if (waitForQualityGate) {
    args.push('-Dsonar.qualitygate.wait=true');
  }
  return args;
}

function runGit(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function gitLines(args) {
  const out = runGit(args);
  return out ? out.split('\n').map((line) => line.trim()).filter(Boolean) : [];
}

function existingPaths(relPaths) {
  return relPaths.filter((rel) => fs.existsSync(path.join(ROOT, rel)));
}

function currentBranch() {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

function resolvePullRequest({ env = process.env, readPrView } = {}) {
  if (env.SONAR_PR_KEY) {
    return {
      key: String(env.SONAR_PR_KEY),
      branch: env.SONAR_PR_BRANCH || currentBranch(),
      base: env.SONAR_PR_BASE || DEFAULT_BASE,
    };
  }
  const read =
    readPrView ||
    (() =>
      execFileSync('gh', ['pr', 'view', '--json', 'number,baseRefName,headRefName'], {
        cwd: ROOT,
        encoding: 'utf8',
      }));
  let parsed;
  try {
    parsed = JSON.parse(read());
  } catch {
    throw new Error(
      'No open GitHub PR for this branch. Open a PR against develop (same as sonarqube-scan.yml) or set SONAR_PR_KEY, SONAR_PR_BRANCH, and SONAR_PR_BASE.',
    );
  }
  if (!parsed?.number) {
    throw new Error(
      'No open GitHub PR for this branch. Open a PR against develop (same as sonarqube-scan.yml) or set SONAR_PR_KEY, SONAR_PR_BRANCH, and SONAR_PR_BASE.',
    );
  }
  return {
    key: String(parsed.number),
    branch: parsed.headRefName || currentBranch(),
    base: parsed.baseRefName || DEFAULT_BASE,
  };
}

function ensureBaseRef(base) {
  const candidates = [`origin/${base}`, base];
  for (const ref of candidates) {
    try {
      runGit(['rev-parse', '--verify', ref]);
      return ref;
    } catch {
      // try the next ref
    }
  }
  throw new Error(
    `Cannot resolve PR base '${base}'. Fetch it first (git fetch origin ${base}) so the scan can diff the same merge-base the PR pipeline uses.`,
  );
}

function collectChangedFiles(baseRef) {
  return existingPaths(
    mergeChangedPaths(
      gitLines(['diff', '--name-only', '--diff-filter=ACMRT', `${baseRef}...HEAD`]),
      gitLines(['diff', '--name-only', '--diff-filter=ACMRT']),
      gitLines(['diff', '--name-only', '--cached', '--diff-filter=ACMRT']),
      gitLines(['ls-files', '--others', '--exclude-standard']),
    ),
  );
}

function resolveRepository(env = process.env) {
  if (env.SONAR_PR_REPOSITORY) {
    return env.SONAR_PR_REPOSITORY;
  }
  try {
    return githubRepositoryFromRemote(runGit(['remote', 'get-url', 'origin']));
  } catch {
    return undefined;
  }
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

function main(argv = process.argv.slice(2), env = process.env) {
  const { dryRun } = parseArgs(argv);
  const token = env.SONAR_TOKEN || env.SONAR_LOGIN;
  if (!token) {
    throw new Error('SONAR_LOGIN (or SONAR_TOKEN) is not set.');
  }
  const pullRequest = resolvePullRequest({ env });
  const baseRef = ensureBaseRef(pullRequest.base);
  const classified = classifyChangedFiles(collectChangedFiles(baseRef));
  if (classified.sources.length === 0 && classified.tests.length === 0) {
    throw new Error(`No scannable files changed vs ${baseRef}.`);
  }
  const args = buildScannerArgs({
    projectKey: env.SONAR_PROJECT_KEY || DEFAULT_PROJECT_KEY,
    pullRequest,
    repository: resolveRepository(env),
    sources: classified.sources,
    tests: classified.tests,
    waitForQualityGate: env.SONAR_QUALITYGATE_WAIT !== 'false',
  });
  const summary = {
    pullRequest,
    baseRef,
    sourceCount: classified.sources.length,
    testCount: classified.tests.length,
    args,
  };
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  }
  process.stdout.write(
    `sonar:pr PR #${pullRequest.key} (${pullRequest.branch} → ${pullRequest.base}) files: ${classified.sources.length} source, ${classified.tests.length} test\n`,
  );
  const result = spawnSync('npx', ['--yes', 'sonarqube-scanner', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...env,
      SONAR_HOST_URL: env.SONAR_HOST_URL || DEFAULT_HOST,
      SONAR_TOKEN: token,
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
  return summary;
}

module.exports = {
  EMPTY_INCLUSION,
  buildScannerArgs,
  classifyChangedFiles,
  githubRepositoryFromRemote,
  isSkippedPath,
  isSonarTestFile,
  main,
  mergeChangedPaths,
  resolvePullRequest,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
