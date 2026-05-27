import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';

/**
 * Browser-side Storyblok Content-Delivery accessor for the top-banner hook.
 *
 * Page rendering goes through the agnostic `CMSService` / `CmsAdapter`
 * pipeline; this accessor exists only for the client-side top-banner fetch,
 * which reads an arbitrary story by full slug (outside the page SPI).
 *
 * Initialised conditionally — only when an access token is configured.
 * Without a token it is a no-op accessor that resolves to `null` (instead
 * of crashing at module-load inside `storyblokInit`); callers treat the
 * `null` case as "no banner configured".
 */
const TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim();

const noopApi = (() => null) as unknown as ReturnType<typeof storyblokInit>;

export const getStoryblokApi: ReturnType<typeof storyblokInit> = TOKEN
  ? storyblokInit({
      accessToken: TOKEN,
      use: [apiPlugin],
      bridge: true,
      apiOptions: {
        maxRetries: 2,
        cache: {
          type: 'none',
        },
      },
    })
  : noopApi;
