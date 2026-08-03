/**
 * Acceptance tests for the PURE, edge-safe Storyblok preview detector
 * (EMP-15 §3).
 *
 * `isStoryblokPreviewRequest(url)` is synchronous, does no I/O, reads no env,
 * and imports nothing from `@storyblok/*`. It validates two pure signals on
 * the query string of a Visual-Editor preview URL:
 *   (1) Presence of all THREE signed keys:
 *       `_storyblok`, `_storyblok_tk[timestamp]`, `_storyblok_tk[token]`.
 *   (2) Timestamp window: `_storyblok_tk[timestamp]` parsed as unix seconds is
 *       valid iff `now - 3600 <= ts <= now + 60` (1h past tolerance, 60s
 *       future skew). Any missing key or parse failure → `false`.
 *
 * The HMAC token *content* is intentionally NOT validated here (board-accepted
 * residual risk, EMP-11 §8 FU-004). These tests therefore never sign a token —
 * they only assert presence + timestamp behaviour.
 *
 * Clock control: timestamp comparisons read the runtime clock, so every test
 * pins `Date.now` with jest fake timers rather than the wall clock.
 */
import { isStoryblokPreviewRequest, storyblokPreviewDetector } from './storyblok-preview-detection';

/** Fixed reference instant: 2026-05-30T12:00:00Z. */
const NOW_MS = Date.UTC(2026, 4, 30, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

/**
 * Build a preview URL. Pass `null` for a key to OMIT it entirely; otherwise the
 * value is used verbatim. `ts` defaults to a fresh (current) timestamp.
 */
function previewUrl(
  opts: {
    storyblok?: string | null;
    timestamp?: string | number | null;
    token?: string | null;
  } = {},
): URL {
  const url = new URL('https://preview.local/preview/main/en/home');
  const { storyblok = '1', timestamp = NOW_SECONDS, token = 'deadbeefcafef00d' } = opts;
  if (storyblok !== null) url.searchParams.set('_storyblok', storyblok);
  if (timestamp !== null) url.searchParams.set('_storyblok_tk[timestamp]', String(timestamp));
  if (token !== null) url.searchParams.set('_storyblok_tk[token]', token);
  return url;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW_MS);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isStoryblokPreviewRequest — detector identity', () => {
  it('exposes the singleton detector with id "storyblok" delegating to the pure function', () => {
    expect(storyblokPreviewDetector.id).toBe('storyblok');
    expect(storyblokPreviewDetector.isPreviewRequest(previewUrl())).toBe(true);
  });
});

describe('isStoryblokPreviewRequest — presence of the three signed keys', () => {
  it('returns true when all three keys are present and the timestamp is fresh', () => {
    expect(isStoryblokPreviewRequest(previewUrl())).toBe(true);
  });

  it('returns false when `_storyblok` is missing', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ storyblok: null }))).toBe(false);
  });

  it('returns false when `_storyblok_tk[timestamp]` is missing', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: null }))).toBe(false);
  });

  it('returns false when `_storyblok_tk[token]` is missing', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ token: null }))).toBe(false);
  });

  it('returns false for a plain (non-preview) URL with no Storyblok params', () => {
    expect(isStoryblokPreviewRequest(new URL('https://preview.local/preview/main/en/home'))).toBe(false);
  });
});

describe('isStoryblokPreviewRequest — timestamp window (now-3600 <= ts <= now+60)', () => {
  it('accepts a timestamp exactly at "now"', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: NOW_SECONDS }))).toBe(true);
  });

  it('accepts a timestamp at the 1h-past boundary (now - 3600)', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: NOW_SECONDS - 3600 }))).toBe(true);
  });

  it('rejects a timestamp older than 1h (now - 3601)', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: NOW_SECONDS - 3601 }))).toBe(false);
  });

  it('accepts a timestamp up to 60s in the future (now + 60)', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: NOW_SECONDS + 60 }))).toBe(true);
  });

  it('rejects a timestamp further than 60s in the future (now + 61)', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: NOW_SECONDS + 61 }))).toBe(false);
  });

  it('rejects a non-numeric timestamp (parse failure → false)', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: 'not-a-number' }))).toBe(false);
  });

  it('rejects an empty-string timestamp', () => {
    expect(isStoryblokPreviewRequest(previewUrl({ timestamp: '' }))).toBe(false);
  });
});

describe('isStoryblokPreviewRequest — purity (no @storyblok import in the source)', () => {
  it('does NOT import the Storyblok SDK (source-text audit — must stay edge-safe)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const path = require('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, './storyblok-preview-detection.ts'), 'utf8') as string;
    const code = source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');

    expect(code).not.toMatch(/@storyblok\//);
    expect(code).not.toMatch(/server-only/);
  });
});
