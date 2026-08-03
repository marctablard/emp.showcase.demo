/**
 * Acceptance tests for the EDGE-SAFE preview-detector registry (EMP-15 §2).
 *
 * `getPreviewDetector(env)` performs static dispatch over the *real*
 * `CmsProviderId` union resolved by `resolveCmsProvider(env)`:
 *   - `'storyblok'` → the pure `storyblokPreviewDetector` (id `'storyblok'`).
 *   - `'local'` | `'none'` → a shared NEVER_PREVIEW detector
 *     (`{ id: 'none', isPreviewRequest: () => false }`).
 * An env value of `'mock'` is unknown to `resolveCmsProvider`; without a token
 * it auto-resolves to `'none'`, so it yields the never-detector too.
 *
 * `PREVIEW_ROUTE_PREFIX` is the single source of truth for the route prefix.
 *
 * The registry MUST stay edge-safe: it may statically import only the pure
 * detection module (no SDK, no `server-only`). A source-text audit pins that.
 */
import { PREVIEW_ROUTE_PREFIX, getPreviewDetector } from './preview-detector-registry';

/** A non-preview URL — never-detectors return false, the storyblok one too. */
const PLAIN_URL = new URL('https://preview.local/preview/main/en/home');

describe('preview-detector-registry — PREVIEW_ROUTE_PREFIX', () => {
  it('is the literal "/preview" (single source of truth for the route prefix)', () => {
    expect(PREVIEW_ROUTE_PREFIX).toBe('/preview');
  });
});

describe('getPreviewDetector — provider dispatch', () => {
  it('returns the Storyblok detector (id "storyblok") when the provider is "storyblok"', () => {
    const detector = getPreviewDetector({ NEXT_CMS_PROVIDER: 'storyblok' } as unknown as NodeJS.ProcessEnv);

    expect(detector.id).toBe('storyblok');
  });

  it('returns the Storyblok detector when a token is present (auto-resolution)', () => {
    const detector = getPreviewDetector({ NEXT_STORYBLOK_ACCESS_TOKEN: 'tk-1' } as unknown as NodeJS.ProcessEnv);

    expect(detector.id).toBe('storyblok');
  });

  it('returns a never-detector (id "none", isPreviewRequest === false) when the provider is "local"', () => {
    const detector = getPreviewDetector({ NEXT_CMS_PROVIDER: 'local' } as unknown as NodeJS.ProcessEnv);

    expect(detector.id).toBe('none');
    expect(detector.isPreviewRequest(PLAIN_URL)).toBe(false);
  });

  it('returns a never-detector when the provider resolves to "none" (no token, no override)', () => {
    const detector = getPreviewDetector({} as NodeJS.ProcessEnv);

    expect(detector.id).toBe('none');
    expect(detector.isPreviewRequest(PLAIN_URL)).toBe(false);
  });

  it('treats an unknown "mock" provider value as "none" (auto-resolves with no token)', () => {
    const detector = getPreviewDetector({ NEXT_CMS_PROVIDER: 'mock' } as unknown as NodeJS.ProcessEnv);

    expect(detector.id).toBe('none');
    expect(detector.isPreviewRequest(PLAIN_URL)).toBe(false);
  });

  it('the never-detector ignores even a well-formed preview query (always false)', () => {
    const detector = getPreviewDetector({ NEXT_CMS_PROVIDER: 'none' } as unknown as NodeJS.ProcessEnv);
    const signed = new URL('https://preview.local/preview/main/en/home');
    signed.searchParams.set('_storyblok', '1');
    signed.searchParams.set('_storyblok_tk[timestamp]', String(Math.floor(Date.now() / 1000)));
    signed.searchParams.set('_storyblok_tk[token]', 'deadbeef');

    expect(detector.isPreviewRequest(signed)).toBe(false);
  });
});

describe('preview-detector-registry — edge safety (source-text audit)', () => {
  it('does NOT import the Storyblok SDK nor `server-only` (must stay in the Edge bundle)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const path = require('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, './preview-detector-registry.ts'), 'utf8') as string;
    const code = source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');

    expect(code).not.toMatch(/@storyblok\//);
    expect(code).not.toMatch(/['"]server-only['"]/);
  });
});
