'use server';

import { headers } from 'next/headers';
import 'server-only';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

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

const PREVIEW_PATH_PREFIX = '/preview/';

/**
 * Lazy-require the platform container.
 *
 * `@/platform/server` initialises the Inversify container at module-load time.
 * Loading it eagerly here would propagate into anything that transitively
 * imports `StoryblokBridgeScript` (the adapter), which in turn forces the
 * container to boot inside node-env platform jest projects that do not stand
 * up the DI graph.
 */
const getLogger = (): LoggerService => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy-load to avoid eager DI-container init in non-server contexts (jest, edge)
  const server = (require('@/platform/server') as { default: { get<T>(id: string): T } }).default;
  return server.get<LoggerService>('LoggerService');
};

/**
 * Resolve the Storyblok bridge SDK configuration for the calling client.
 *
 * Returns `null` when the access token is unset / blank, when there is no
 * `referer` header, or when the referer pathname is not under `/preview/`.
 * Otherwise returns `{ accessToken }`.
 *
 * Access-check rationale: the bridge token must only be handed out when the
 * caller is rendering inside the Visual-Editor preview surface. Cross-origin
 * submissions are rejected by the Next.js server-action CSRF layer before
 * the action body runs, so a referer-path check is sufficient here.
 */
export async function getStoryblokBridgeConfig(): Promise<StoryblokBridgeConfig | null> {
  const accessToken = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return null;
  }

  const headerList = await headers();
  const referer = headerList.get('referer');
  if (!referer) {
    getLogger().warn({ referer }, 'bridge-token denied: missing referer');
    return null;
  }

  let pathname: string;
  try {
    pathname = new URL(referer).pathname;
  } catch {
    getLogger().warn({ referer }, 'bridge-token denied: invalid referer URL');
    return null;
  }

  if (!pathname.startsWith(PREVIEW_PATH_PREFIX)) {
    getLogger().warn({ referer }, 'bridge-token denied: referer is not /preview/*');
    return null;
  }

  return { accessToken };
}
