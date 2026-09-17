import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../verify-audit-policy.mjs');
/** Fixture allowlist — independent of production ALLOWED_EXCEPTIONS (review 5235825162). */
const FIXTURE_ID = 'GHSA-aaaa-bbbb-cccc';
const FIXTURE_EXPIRES = '2030-01-15';
const FIXTURE_EXCEPTIONS_JSON = JSON.stringify([
  {
    id: FIXTURE_ID,
    expires: FIXTURE_EXPIRES,
    reason: 'jest fixture; not a production exception',
    securitySignOff: { ticket: 'TEST', recordedIn: 'jest-fixture' },
  },
]);
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
      id: FIXTURE_ID,
      asOf: shiftUtcDay(FIXTURE_EXPIRES, -1),
      ok: true,
    },
    {
      name: 'an unlisted high advisory',
      id: 'GHSA-0000-1111-2222',
      asOf: FIXTURE_EXPIRES,
      ok: false,
    },
    {
      name: 'an expired exception',
      id: FIXTURE_ID,
      asOf: shiftUtcDay(FIXTURE_EXPIRES, 1),
      ok: false,
    },
    {
      name: 'the expiry-day boundary',
      id: FIXTURE_ID,
      asOf: FIXTURE_EXPIRES,
      ok: true,
    },
  ] as const)('gates $name', ({ id, asOf, ok }) => {
    const report = advisoryReport(id);
    const args = [`--as-of=${asOf}`, `--exceptions-json=${FIXTURE_EXCEPTIONS_JSON}`];
    if (ok) {
      expect(runPolicy(report, { args })).toContain('verify-audit-policy: OK');
      return;
    }
    expect(() => runPolicy(report, { args })).toThrow(/one or more high\/critical advisories/);
  });

  it('rejects --as-of outside Jest so CI cannot backdate exception expiry', () => {
    expect(() =>
      runPolicy(advisoryReport(FIXTURE_ID), { args: [`--as-of=${FIXTURE_EXPIRES}`], inheritJest: false }),
    ).toThrow(/clock override --as-of is test-only/);
  });

  it('rejects VERIFY_AUDIT_POLICY_TODAY outside Jest', () => {
    expect(() =>
      runPolicy(advisoryReport(FIXTURE_ID), {
        env: { VERIFY_AUDIT_POLICY_TODAY: FIXTURE_EXPIRES },
        inheritJest: false,
      }),
    ).toThrow(/VERIFY_AUDIT_POLICY_TODAY is test-only/);
  });

  it('rejects --exceptions-json outside Jest so CI cannot inject a fake allowlist', () => {
    expect(() =>
      runPolicy(advisoryReport(FIXTURE_ID), {
        args: [`--exceptions-json=${FIXTURE_EXCEPTIONS_JSON}`],
        inheritJest: false,
      }),
    ).toThrow(/exceptions override --exceptions-json is test-only/);
  });

  it('rejects a securitySignOff that only records the implementing GitHub PR', () => {
    const selfSigned = JSON.stringify([
      {
        id: FIXTURE_ID,
        expires: FIXTURE_EXPIRES,
        reason: 'unsigned fixture',
        securitySignOff: {
          ticket: 'TEST',
          recordedIn: 'https://github.com/emporix/emporix-showcase/pull/424',
        },
      },
    ]);
    expect(() => runPolicy(advisoryReport(FIXTURE_ID), { args: [`--exceptions-json=${selfSigned}`] })).toThrow(
      /missing securitySignOff/,
    );
  });

  it('rejects an injected exception that has no securitySignOff', () => {
    const unsigned = JSON.stringify([{ id: FIXTURE_ID, expires: FIXTURE_EXPIRES, reason: 'unsigned fixture' }]);
    expect(() => runPolicy(advisoryReport(FIXTURE_ID), { args: [`--exceptions-json=${unsigned}`] })).toThrow(
      /missing securitySignOff/,
    );
  });
});
