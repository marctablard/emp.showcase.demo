'use server';

import 'server-only';

/**
 * Bridge-config payload returned to the client-side `StoryblokBridgeScript`
 * when the request is allowed to bootstrap the Storyblok Visual-Editor bridge.
 *
 * Server-only by `'use server';` + `'server-only';`: the access token never
 * lands in the browser bundle; it only crosses the wire as the resolved
 * payload of this action and only when the caller is on a `/preview/*` route.
 */
export interface StoryblokBridgeConfig {
  readonly accessToken: string;
}

/**
 * Resolve the Storyblok bridge SDK configuration for the calling client.
 *
 * Returns `null` when the access token is unset / blank, when there is no
 * `referer` header, or when the referer pathname is not under `/preview/`.
 * Otherwise returns `{ accessToken }`. The real implementation is added in
 * the Phase-B implementation commit; this stub keeps the test file
 * compilable while the failing acceptance tests are in place.
 */
export async function getStoryblokBridgeConfig(): Promise<StoryblokBridgeConfig | null> {
  throw new Error('getStoryblokBridgeConfig: not implemented');
}
