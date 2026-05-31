'use server';

import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';
import 'server-only';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

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

const STORY_SLUG = 'cdn/stories/top-banner-announcement';

/**
 * Lazy-require the platform container.
 *
 * `@/platform/server` initialises the Inversify container at module-load time.
 * Loading it eagerly here would propagate into anything that transitively
 * imports this action, forcing the container to boot inside node-env platform
 * jest projects that do not stand up the DI graph.
 */
const getLogger = (): LoggerService => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy-load to avoid eager DI-container init in non-server contexts (jest, edge)
  const server = (require('@/platform/server') as { default: { get<T>(id: string): T } }).default;
  return server.get<LoggerService>('LoggerService');
};

/**
 * Resolve the top-banner story for the given locale.
 *
 * Returns `null` when no Storyblok token is configured (unset or whitespace),
 * when the Storyblok SDK refuses to bootstrap, or when the underlying fetch
 * rejects — in the fetch-error case a warn-log is emitted. Otherwise returns
 * the SDK's `response.data` payload unchanged.
 *
 * The token is read server-side from `NEXT_STORYBLOK_ACCESS_TOKEN`; the
 * preview switch is read from `NEXT_STORYBLOK_ACCESS_PREVIEW` (strict
 * `'true'` comparison — mismatched case yields `published`). Neither value
 * ever crosses to the browser.
 */
export async function fetchTopBanner({ locale }: { locale: string }): Promise<TopBannerData | null> {
  const token = process.env.NEXT_STORYBLOK_ACCESS_TOKEN?.trim();
  if (!token) {
    return null;
  }

  // `storyblokInit` returns an *accessor* function `() => StoryblokClient`
  // (see `node_modules/@storyblok/react/dist/rsc.d.ts:139`). Calling
  // `storyblokInit({...}).get(...)` directly would crash at runtime with
  // `api.get is not a function`. We must invoke the accessor to get the
  // client. Same pattern as `StoryblokCmsApi.ts:74-90`.
  //
  // We defensively bail both when `storyblokInit` itself returns null and
  // when the accessor it returns resolves to a null client.
  type StoryblokBannerClient = {
    get(slug: string, params: { version: 'draft' | 'published'; language: string }): Promise<{ data: TopBannerData }>;
  };
  const accessor = storyblokInit({ accessToken: token, use: [apiPlugin] }) as unknown as
    | (() => StoryblokBannerClient | null)
    | null;
  const api = accessor?.() ?? null;
  if (!api) {
    return null;
  }

  const version: 'draft' | 'published' = process.env.NEXT_STORYBLOK_ACCESS_PREVIEW === 'true' ? 'draft' : 'published';

  try {
    const response = await api.get(STORY_SLUG, { version, language: locale });
    return response.data;
  } catch (err) {
    getLogger().warn({ err }, 'fetchTopBanner: storyblok api.get failed');
    return null;
  }
}
