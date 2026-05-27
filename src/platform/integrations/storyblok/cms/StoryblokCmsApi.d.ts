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
   * Fetches a single story by slug. Resolves to the raw SDK payload on
   * success, or `null` when there is no token, the SDK throws, or the
   * response carries no `data.story`. Never rejects.
   *
   * Multi-site slug prefixing and draft/published version resolution are
   * applied internally from environment configuration.
   */
  getStory(slug: string, locale: string, site?: string): Promise<StoryblokStoryResult | null>;
}
