import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../verify-audit-policy.mjs');
const EMPTY_REPORT = JSON.stringify({
  vulnerabilities: {},
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
});

function runPolicy(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-policy-'));
  const reportPath = path.join(dir, 'audit-report.json');
  fs.writeFileSync(reportPath, contents);
  try {
    return execFileSync(process.execPath, [SCRIPT, reportPath], { encoding: 'utf8' });
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
});
