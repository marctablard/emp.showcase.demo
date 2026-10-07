import type { CmsPreviewDetector } from '@/platform/services/cms/preview/CmsPreviewDetector';

/**
 * PURE, edge-safe Storyblok preview detection (EMP-15 §3).
 *
 * `isStoryblokPreviewRequest(url)` is synchronous, does no I/O, reads no env,
 * and imports nothing from `@storyblok/*` — so it is legal to evaluate from
 * the Edge middleware bundle. It validates the two pure signals on a
 * Visual-Editor preview URL:
 *
 *   (1) Presence of all THREE signed keys in the query string:
 *       `_storyblok`, `_storyblok_tk[timestamp]`, `_storyblok_tk[token]`.
 *   (2) Timestamp window: `_storyblok_tk[timestamp]` parsed as unix seconds is
 *       valid iff `now - 3600 <= ts <= now + 60` (1h past tolerance, 60s
 *       future skew). `now` is the current unix epoch second read from the
 *       runtime clock. Any missing key or parse failure → `false`.
 *
 * The HMAC token *content* is intentionally NOT validated here (board-accepted
 * residual risk, EMP-11 §8 FU-004) — that is the adapter's concern, and even
 * there only presence is checked.
 */

const STORYBLOK_KEY = '_storyblok';
const TIMESTAMP_KEY = '_storyblok_tk[timestamp]';
const TOKEN_KEY = '_storyblok_tk[token]';

/** 1h past tolerance, in seconds. */
const PAST_TOLERANCE_SECONDS = 3600;
/** 60s future clock-skew tolerance, in seconds. */
const FUTURE_SKEW_SECONDS = 60;

export function isStoryblokPreviewRequest(url: URL): boolean {
  const params = url.searchParams;

  // (1) Presence of all three signed keys.
  if (!params.has(STORYBLOK_KEY) || !params.has(TIMESTAMP_KEY) || !params.has(TOKEN_KEY)) {
    return false;
  }

  // (2) Timestamp window. Reject any non-numeric / empty / out-of-window value.
  const raw = params.get(TIMESTAMP_KEY);
  if (raw === null || raw.trim() === '') {
    return false;
  }
  const ts = Number(raw);
  if (!Number.isFinite(ts)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return ts >= now - PAST_TOLERANCE_SECONDS && ts <= now + FUTURE_SKEW_SECONDS;
}

/** Singleton edge-safe detector delegating to the pure function above. */
export const storyblokPreviewDetector: CmsPreviewDetector = {
  id: 'storyblok',
  isPreviewRequest: isStoryblokPreviewRequest,
};
