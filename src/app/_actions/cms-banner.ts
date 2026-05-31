'use server';

import 'server-only';

/**
 * Payload returned to client-side callers (`useBanner`) for the top-banner.
 *
 * The action keeps the Storyblok access token on the server: clients only
 * ever observe this resolved payload, never the env value itself.
 *
 * Shape is intentionally loose (`unknown` story body) at the action contract;
 * the hook layer types it precisely against its own renderer's expectations.
 */
export interface TopBannerData {
  readonly story?: unknown;
}

/**
 * Resolve the top-banner story for the given locale.
 *
 * Returns `null` when no Storyblok token is configured. Implementation lands
 * in the same commit as the banner-api delete + use-banner refactor.
 */
export async function fetchTopBanner(_args: { locale: string }): Promise<TopBannerData | null> {
  throw new Error('fetchTopBanner: not implemented');
}
