#!/usr/bin/env node
/**
 * Enforces the repo's npm audit policy in CI.
 *
 * Consumes the JSON produced by `npm audit --audit-level=high --json` and
 * fails unless every high/critical advisory found in the report is covered
 * by an active (non-expired) entry in ALLOWED_EXCEPTIONS below.
 *
 * This intentionally does NOT rely on npm's own process exit code: `npm
 * audit --audit-level=high` exits non-zero the moment it finds any
 * high/critical advisory, which is exactly the (narrow, temporary) case
 * this script exists to tolerate. Instead the pass/fail decision is
 * re-derived from the report content itself, so:
 *   - any high/critical advisory NOT listed in ALLOWED_EXCEPTIONS fails CI
 *   - a listed exception whose `expires` date has passed fails CI
 *   - a missing, empty, unparsable, or unexpectedly-shaped report fails CI
 *   - a report with zero high/critical advisories passes CI
 *
 * Do NOT weaken this script to force a pass (e.g. broadening the allowlist,
 * removing the expiry check, or ignoring malformed reports) — see
 * docs/run-build-deploy.md ("npm audit Policy Exceptions") before changing
 * ALLOWED_EXCEPTIONS.
 *
 * Used by PR preview and smoke_prod. ALLOWED_EXCEPTIONS is global to this
 * module — an entry here applies to every caller. Do not add one unless it
 * is acceptable on both jobs. See docs/run-build-deploy.md.
 *
 * Usage:
 *   npm audit --audit-level=high --json > audit-report.json || true
 *   node scripts/verify-audit-policy.mjs audit-report.json
 *
 * Jest may pass `--as-of=YYYY-MM-DD` while `JEST_WORKER_ID` is set. CI must
 * not set that flag or `VERIFY_AUDIT_POLICY_TODAY`.
 */
import fs from 'node:fs';

// --- Policy: narrowly-scoped, time-boxed exceptions only. -----------------
// Every entry MUST have an explicit, short-lived `expires` date (YYYY-MM-DD,
// exception is valid through the end of that UTC day) and a `reason`
// explaining why upgrading is not currently safe. Remove the entry once a
// real fix lands or the date passes — do not silently extend `expires`.
const ALLOWED_EXCEPTIONS = [
  {
    id: 'GHSA-p293-qw3h-jr36',
    expires: '2026-10-12',
    reason:
      'Next 16.3.x lockfile rewrite OOMs npm ci on GitHub runners; stay on the last installable 16.2.12 lockfile until a generated lockfile installs.',
  },
  {
    id: 'GHSA-2xp9-vwfh-vxw4',
    expires: '2026-10-12',
    reason:
      'Same Next 16.3.x lockfile OOM; stay on the last installable 16.2.12 lockfile until a generated lockfile installs.',
  },
  {
    id: 'GHSA-rgj7-g3m4-5g8c',
    expires: '2026-10-12',
    reason: 'sharp 0.35.4 lockfile rewrite OOMs npm ci; keep 0.35.3 until a generated lockfile installs.',
  },
  {
    id: 'GHSA-2883-xcg3-v3hh',
    expires: '2026-10-12',
    reason: 'js-yaml 3.15.2/4.3.2 lockfile rewrite OOMs npm ci; keep current pins until a generated lockfile installs.',
  },
  {
    id: 'GHSA-j95f-988m-3j2f',
    expires: '2026-10-12',
    reason:
      'A single @tiptap/core override mismatches @tiptap/pm 3.30.0 peers. Leave the Storyblok-owned 3.30.0 set until a full 3.30.5 lockfile can be generated.',
  },
];

const FAIL_SEVERITIES = new Set(['high', 'critical']);
const GHSA_RE = /GHSA-[0-9a-z]+-[0-9a-z]+-[0-9a-z]+/i;

class AuditPolicyError extends Error {}

function fail(message) {
  throw new AuditPolicyError(message);
}

function consumeJsonStringChar(ch, escape) {
  if (escape) {
    return { inString: true, escape: false };
  }
  if (ch === '\\') {
    return { inString: true, escape: true };
  }
  return { inString: ch !== '"', escape: false };
}

/**
 * npm/safe-chain sometimes append a notice after `npm audit --json`.
 * Take the first complete object; still fail if that object is not a report.
 */
function extractFirstJsonObject(raw) {
  const start = raw.indexOf('{');
  if (start === -1) {
    return undefined;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      ({ inString, escape } = consumeJsonStringChar(ch, escape));
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  return undefined;
}

function parseAuditReportJson(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch (firstError) {
    const extracted = extractFirstJsonObject(trimmed);
    if (!extracted) {
      throw firstError;
    }
    return JSON.parse(extracted);
  }
}

function readReport(reportPath) {
  let raw;
  try {
    raw = fs.readFileSync(reportPath, 'utf8');
  } catch (err) {
    fail(`could not read audit report at "${reportPath}": ${err.message}`);
  }
  if (!raw || !raw.trim()) {
    fail(`audit report at "${reportPath}" is empty — npm audit likely failed to run (network/registry error?)`);
  }
  let report;
  try {
    report = parseAuditReportJson(raw);
  } catch (err) {
    fail(`audit report at "${reportPath}" is not valid JSON: ${err.message}`);
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    fail('audit report has an unexpected shape (expected a JSON object)');
  }
  if (report.error) {
    fail(`npm audit reported an error instead of a report: ${JSON.stringify(report.error)}`);
  }
  const { vulnerabilities } = report;
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    fail('audit report is missing a valid "vulnerabilities" object — cannot verify policy');
  }
  return report;
}

/**
 * Collects every distinct advisory referenced anywhere in the report.
 *
 * `via` entries on a vulnerability node can be either:
 *   - a plain dependency-name string: transitive propagation through
 *     another already-reported package, NOT itself a new advisory, or
 *   - an advisory object with its own `severity`/`url`/`title`/`source`.
 *
 * Only advisory objects represent an actual disclosed vulnerability, so
 * string entries are skipped — they would otherwise be (incorrectly)
 * treated as separate, unlisted advisories.
 */
function isAdvisoryEntry(via) {
  // A `via` entry is either an advisory object or a plain dependency-name
  // string (transitive propagation, not itself a new advisory).
  return Boolean(via) && typeof via === 'object';
}

function advisoryIdFromVia(via) {
  const url = typeof via.url === 'string' ? via.url : '';
  const match = url.match(GHSA_RE);
  const id = match ? match[0] : `NPM-ADVISORY-${via.source ?? 'UNKNOWN'}`;
  return { id, url };
}

function recordAdvisory(advisoriesById, via, severity, pkgName) {
  const { id, url } = advisoryIdFromVia(via);

  if (!advisoriesById.has(id)) {
    advisoriesById.set(id, {
      id,
      severity,
      title: via.title || '(no title)',
      url: url || '(no url)',
      packages: new Set(),
    });
  }
  advisoriesById.get(id).packages.add(via.dependency || pkgName);
}

function collectVulnerabilityAdvisories(advisoriesById, pkgName, vuln) {
  if (!vuln || typeof vuln !== 'object' || !Array.isArray(vuln.via)) return;

  for (const via of vuln.via) {
    if (!isAdvisoryEntry(via)) continue; // dependency-name string, not an advisory
    const severity = via.severity || vuln.severity;
    if (!FAIL_SEVERITIES.has(severity)) continue;
    recordAdvisory(advisoriesById, via, severity, pkgName);
  }
}

function collectAdvisories(vulnerabilities) {
  const advisoriesById = new Map();

  for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
    collectVulnerabilityAdvisories(advisoriesById, pkgName, vuln);
  }

  return [...advisoriesById.values()];
}

function parseAsOfArg(argv) {
  const flag = argv.find((arg) => arg.startsWith('--as-of='));
  return flag ? flag.slice('--as-of='.length) : undefined;
}

/**
 * Clock override is Jest-only (`JEST_WORKER_ID` + `--as-of=YYYY-MM-DD`).
 * CI always uses the real UTC date so expired exceptions cannot be backdated.
 */
function resolvePolicyToday(argv = process.argv) {
  const asOfFlag = parseAsOfArg(argv);
  if (process.env.VERIFY_AUDIT_POLICY_TODAY && !process.env.JEST_WORKER_ID) {
    fail('VERIFY_AUDIT_POLICY_TODAY is test-only; unset it so exception expiry cannot be backdated');
  }
  if (asOfFlag && !process.env.JEST_WORKER_ID) {
    fail('clock override --as-of is test-only');
  }
  if (!asOfFlag || !process.env.JEST_WORKER_ID) {
    return new Date();
  }
  const parsed = new Date(`${asOfFlag}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    fail(`clock override --as-of is not a valid YYYY-MM-DD date: "${asOfFlag}"`);
  }
  return parsed;
}

function evaluateAdvisories(advisories, today) {
  const disallowed = [];
  const tolerated = [];

  for (const advisory of advisories) {
    const exception = ALLOWED_EXCEPTIONS.find((e) => e.id.toLowerCase() === advisory.id.toLowerCase());
    if (!exception) {
      disallowed.push({ ...advisory, reason: 'not in ALLOWED_EXCEPTIONS' });
      continue;
    }
    const expires = new Date(`${exception.expires}T23:59:59.999Z`);
    if (Number.isNaN(expires.getTime())) {
      disallowed.push({ ...advisory, reason: `exception has an invalid expires date: "${exception.expires}"` });
      continue;
    }
    if (today > expires) {
      disallowed.push({ ...advisory, reason: `exception expired on ${exception.expires}` });
      continue;
    }
    tolerated.push({ ...advisory, exception });
  }

  return { disallowed, tolerated };
}

function formatAdvisory(a) {
  return [
    `  - ${a.id} (${a.severity}) ${a.title}`,
    `    packages: ${[...a.packages].join(', ')}`,
    `    url: ${a.url}`,
    `    reason: ${a.reason}`,
  ].join('\n');
}

function main() {
  const [, , reportPathArg] = process.argv;
  if (!reportPathArg) {
    fail('missing required argument: path to an `npm audit --json` report (e.g. audit-report.json)');
  }

  const report = readReport(reportPathArg);
  const advisories = collectAdvisories(report.vulnerabilities);

  if (advisories.length === 0) {
    console.log('verify-audit-policy: OK — no high/critical advisories found.');
    return;
  }

  const { disallowed, tolerated } = evaluateAdvisories(advisories, resolvePolicyToday());

  if (disallowed.length > 0) {
    console.error(
      'verify-audit-policy: FAILED — the following high/critical advisories are not covered by an active exception:',
    );
    for (const a of disallowed) {
      console.error(formatAdvisory(a));
    }
    fail('one or more high/critical advisories are not covered by an active, non-expired exception');
  }

  console.warn('verify-audit-policy: WARNING — passing only due to active, time-boxed exception(s):');
  for (const a of tolerated) {
    console.warn(`  - ${a.id} (${a.severity}) ${a.title} — expires ${a.exception.expires}`);
    console.warn(`    packages: ${[...a.packages].join(', ')}`);
    console.warn(`    reason: ${a.exception.reason}`);
  }
  console.log('verify-audit-policy: OK — all high/critical advisories are covered by active exceptions above.');
}

try {
  main();
} catch (err) {
  if (err instanceof AuditPolicyError) {
    console.error(`verify-audit-policy: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
