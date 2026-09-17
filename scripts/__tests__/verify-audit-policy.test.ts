import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../verify-audit-policy.mjs');
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT, 'utf8');
const FIRST_EXCEPTION = /id: '(GHSA-[^']+)',\s*\n\s*expires: '(\d{4}-\d{2}-\d{2})'/.exec(SCRIPT_SOURCE);
if (!FIRST_EXCEPTION) {
  throw new Error('Could not read the first ALLOWED_EXCEPTIONS entry from verify-audit-policy.mjs');
}
const ALLOWED_ID = FIRST_EXCEPTION[1];
const ALLOWED_EXPIRES = FIRST_EXCEPTION[2];
const EMPTY_REPORT = JSON.stringify({
  vulnerabilities: {},
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
});

function shiftUtcDay(isoDate: string, deltaDays: number): string {
  const next = new Date(`${isoDate}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next.toISOString().slice(0, 10);
}

function advisoryReport(id: string): string {
  return JSON.stringify({
    vulnerabilities: {
      next: {
        name: 'next',
        severity: 'high',
        via: [
          {
            source: 1,
            name: 'next',
            dependency: 'next',
            title: 'test advisory',
            severity: 'high',
            url: `https://github.com/advisories/${id}`,
          },
        ],
      },
    },
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
  });
}

function runPolicy(
  contents: string,
  options: { args?: string[]; env?: NodeJS.ProcessEnv; inheritJest?: boolean } = {},
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-policy-'));
  const reportPath = path.join(dir, 'audit-report.json');
  fs.writeFileSync(reportPath, contents);
  const env: NodeJS.ProcessEnv = { ...process.env, ...options.env };
  if (options.inheritJest === false) {
    delete env.JEST_WORKER_ID;
  }
  try {
    return execFileSync(process.execPath, [SCRIPT, reportPath, ...(options.args ?? [])], {
      encoding: 'utf8',
      env,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('verify-audit-policy', () => {
  it('accepts a valid report followed by a trailing npm notice', () => {
    const out = runPolicy(`${EMPTY_REPORT}\nnpm notice Changelog: https://github.com/npm/cli/releases/tag/v11.10.0\n`);
    expect(out).toContain('verify-audit-policy: OK');
  });

  it('still fails when the leading JSON is not an audit report', () => {
    expect(() => runPolicy('{"error":{"code":"ENOAUDIT","summary":"registry down"}}\n')).toThrow(/npm audit reported an error/);
  });

  it.each([
    {
      name: 'an active allowed ID',
      id: ALLOWED_ID,
      asOf: shiftUtcDay(ALLOWED_EXPIRES, -1),
      ok: true,
    },
    {
      name: 'an unlisted high advisory',
      id: 'GHSA-0000-1111-2222',
      asOf: ALLOWED_EXPIRES,
      ok: false,
    },
    {
      name: 'an expired exception',
      id: ALLOWED_ID,
      asOf: shiftUtcDay(ALLOWED_EXPIRES, 1),
      ok: false,
    },
    {
      name: 'the expiry-day boundary',
      id: ALLOWED_ID,
      asOf: ALLOWED_EXPIRES,
      ok: true,
    },
  ] as const)('gates $name', ({ id, asOf, ok }) => {
    const report = advisoryReport(id);
    const args = [`--as-of=${asOf}`];
    if (ok) {
      expect(runPolicy(report, { args })).toContain('verify-audit-policy: OK');
      return;
    }
    expect(() => runPolicy(report, { args })).toThrow(/one or more high\/critical advisories/);
  });

  it('rejects --as-of outside Jest so CI cannot backdate exception expiry', () => {
    expect(() =>
      runPolicy(advisoryReport(ALLOWED_ID), { args: [`--as-of=${ALLOWED_EXPIRES}`], inheritJest: false }),
    ).toThrow(/clock override --as-of is test-only/);
  });

  it('rejects VERIFY_AUDIT_POLICY_TODAY outside Jest', () => {
    expect(() =>
      runPolicy(advisoryReport(ALLOWED_ID), {
        env: { VERIFY_AUDIT_POLICY_TODAY: ALLOWED_EXPIRES },
        inheritJest: false,
      }),
    ).toThrow(/VERIFY_AUDIT_POLICY_TODAY is test-only/);
  });
});
