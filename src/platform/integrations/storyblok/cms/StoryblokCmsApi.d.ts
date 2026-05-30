import type { ISbStoryData } from '@storyblok/react/rsc';

/**
 * Encapsulation boundary for the Storyblok Content-Delivery SDK.
 *
 * The API class is the ONLY module that imports `@storyblok/react/rsc` for
 * content delivery; every other Storyblok-aware module talks to it through
 * this typed interface. That keeps the SDK lazy-init, the token guard, and
 * the env-driven version resolution in one place.
 */
export interface StoryblokStoryResult {
  data: {
    story: ISbStoryData;
  };
}

export interface StoryblokCmsApi {
  /**
   * Returns `true` when a non-empty access token is configured — mirrors the
   * lazy-init guard so the adapter's `hasContent()` agrees with it.
   */
  hasToken(): boolean;

  /**
   * Returns the configured Storyblok space id (from
   * `NEXT_PUBLIC_STORYBLOK_SPACE_ID`, trimmed), or `null` when unset / blank.
   * The preview adapter compares it against the signed
   * `_storyblok_tk[space_id]`; a `null` here means the adapter SKIPS that
   * check (documented residual risk, FU-004).
   */
  getSpaceId(): string | null;

  /**
   * Fetches a single story by slug. Resolves to the raw SDK payload on
   * success, or `null` when there is no token, the SDK throws, or the
   * response carries no `data.story`. Never rejects.
   *
   * Multi-site slug prefixing and draft/published version resolution are
   * applied internally from environment configuration. Pass `version` to
   * force a specific version regardless of env (layouts are always fetched
   * `published` so editor drafts never leak into the storefront frame).
   */
  getStory(
    slug: string,
    locale: string,
    site?: string,
    version?: 'draft' | 'published',
  ): Promise<StoryblokStoryResult | null>;
}
