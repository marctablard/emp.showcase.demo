const {
  EMPTY_INCLUSION,
  buildScannerArgs,
  classifyChangedFiles,
  githubRepositoryFromRemote,
  isSkippedPath,
  isSonarTestFile,
  mergeChangedPaths,
  resolvePullRequest,
} = require('../sonar-pr-scan.cjs') as {
  EMPTY_INCLUSION: string;
  buildScannerArgs: (input: {
    projectKey: string;
    pullRequest?: { key: string; branch: string; base: string };
    repository?: string;
    sources: string[];
    tests: string[];
    waitForQualityGate?: boolean;
  }) => string[];
  classifyChangedFiles: (paths: string[]) => { sources: string[]; tests: string[] };
  githubRepositoryFromRemote: (remoteUrl: string) => string | undefined;
  isSkippedPath: (relPath: string) => boolean;
  isSonarTestFile: (relPath: string) => boolean;
  mergeChangedPaths: (...groups: string[][]) => string[];
  resolvePullRequest: (input: {
    env?: NodeJS.ProcessEnv;
    readPrView?: () => string;
  }) => { key: string; branch: string; base: string };
};

describe('sonar-pr-scan', () => {
  it('treats Jest/Playwright files as tests, matching sonar-project.properties', () => {
    expect(isSonarTestFile('src/hooks/checkout/useCheckout.test.tsx')).toBe(true);
    expect(isSonarTestFile('e2e/homepage.spec.ts')).toBe(true);
    expect(isSonarTestFile('e2e/local/auth.md')).toBe(true);
    expect(isSonarTestFile('src/hooks/checkout/useCheckout.ts')).toBe(false);
  });

  it('skips binaries and scanner-excluded trees', () => {
    expect(isSkippedPath('figma/B2B New Showcase.fig')).toBe(true);
    expect(isSkippedPath('coverage/lcov.info')).toBe(true);
    expect(isSkippedPath('node_modules/foo/index.js')).toBe(true);
    expect(isSkippedPath('src/components/cart/cart-summary.tsx')).toBe(false);
  });

  it('splits PR changes into source vs test inclusions and drops skipped paths', () => {
    expect(
      classifyChangedFiles([
        'src/components/cart/cart-summary.tsx',
        'src/components/cart/quote-request-dialog.test.tsx',
        'figma/design.fig',
        'src/components/cart/cart-summary.tsx',
      ]),
    ).toEqual({
      sources: ['src/components/cart/cart-summary.tsx'],
      tests: ['src/components/cart/quote-request-dialog.test.tsx'],
    });
  });

  it('builds the same PR parameters the scan workflow uses on pull_request', () => {
    expect(
      buildScannerArgs({
        projectKey: 'emporix-showcase',
        pullRequest: {
          key: '417',
          branch: 'prerelease/release.1.9.0-version-bump',
          base: 'develop',
        },
        repository: 'emporix/emporix-showcase',
        sources: ['src/hooks/checkout/useCheckout.ts'],
        tests: ['src/hooks/checkout/useCheckout.test.tsx'],
      }),
    ).toEqual([
      '-Dsonar.projectKey=emporix-showcase',
      '-Dsonar.pullrequest.key=417',
      '-Dsonar.pullrequest.branch=prerelease/release.1.9.0-version-bump',
      '-Dsonar.pullrequest.base=develop',
      '-Dsonar.pullrequest.provider=github',
      '-Dsonar.pullrequest.github.repository=emporix/emporix-showcase',
      '-Dsonar.inclusions=src/hooks/checkout/useCheckout.ts',
      '-Dsonar.test.inclusions=src/hooks/checkout/useCheckout.test.tsx',
      '-Dsonar.qualitygate.wait=true',
    ]);
  });

  it('uses a never-match inclusion when a side of the PR diff is empty', () => {
    const args = buildScannerArgs({
      projectKey: 'emporix-showcase',
      pullRequest: { key: '1', branch: 'feat', base: 'develop' },
      sources: [],
      tests: ['e2e/homepage.spec.ts'],
      waitForQualityGate: false,
    });
    expect(args).toContain(`-Dsonar.inclusions=${EMPTY_INCLUSION}`);
    expect(args).toContain('-Dsonar.test.inclusions=e2e/homepage.spec.ts');
    expect(args).not.toContain('-Dsonar.qualitygate.wait=true');
  });

  it('reads PR identity from SONAR_PR_* so the local scan can match CI without gh', () => {
    expect(
      resolvePullRequest({
        env: {
          SONAR_PR_KEY: '417',
          SONAR_PR_BRANCH: 'prerelease/release.1.9.0-version-bump',
          SONAR_PR_BASE: 'develop',
        },
      }),
    ).toEqual({
      key: '417',
      branch: 'prerelease/release.1.9.0-version-bump',
      base: 'develop',
    });
  });

  it('reads PR identity from gh pr view, the same GitHub PR the pipeline analyzes', () => {
    expect(
      resolvePullRequest({
        env: {},
        readPrView: () =>
          JSON.stringify({
            number: 417,
            baseRefName: 'develop',
            headRefName: 'prerelease/release.1.9.0-version-bump',
          }),
      }),
    ).toEqual({
      key: '417',
      branch: 'prerelease/release.1.9.0-version-bump',
      base: 'develop',
    });
  });

  it('fails closed when there is no PR — do not fall back to a full-repo scan', () => {
    expect(() =>
      resolvePullRequest({
        env: {},
        readPrView: () => {
          throw new Error('no pr');
        },
      }),
    ).toThrow(/Open a PR against develop/);
  });

  it('parses GitHub remotes for sonar.pullrequest.github.repository', () => {
    expect(githubRepositoryFromRemote('git@github.com:emporix/emporix-showcase.git')).toBe(
      'emporix/emporix-showcase',
    );
    expect(githubRepositoryFromRemote('https://github.com/emporix/emporix-showcase.git')).toBe(
      'emporix/emporix-showcase',
    );
  });

  it('merges committed and working-tree paths without duplicates', () => {
    expect(mergeChangedPaths(['src/a.ts', 'src/b.ts'], ['src/a.ts', 'src/c.ts'])).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
    ]);
  });
});
