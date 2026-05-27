import { type ISbStoriesParams, type StoryblokClient, apiPlugin, storyblokInit } from '@storyblok/react/rsc';
import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { StoryblokCmsApi as StoryblokCmsApiContract, StoryblokStoryResult } from '../StoryblokCmsApi';

type StoryblokApiAccessor = () => StoryblokClient | null;

/**
 * SDK encapsulation for the Storyblok Content-Delivery API.
 *
 * Init is lazy: `storyblokInit` is not called at module load nor in the
 * constructor — only on the first `getStory()` call that has a configured
 * access token. The resulting accessor is memoised so subsequent calls
 * reuse a single SDK client. Without a token, `getStory()` resolves to
 * `null` and `storyblokInit` is never touched, so the app boots cleanly.
 */
@injectable('StoryblokCmsApi', 'Singleton')
export class StoryblokCmsApi implements StoryblokCmsApiContract {
  private accessor: StoryblokApiAccessor | null = null;

  constructor(@inject('LoggerService') private readonly logger: LoggerService) {}

  hasToken(): boolean {
    return this.token().length > 0;
  }

  async getStory(slug: string, locale: string, site?: string): Promise<StoryblokStoryResult | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    const fullSlug = this.resolveSlug(slug, site);
    const params: ISbStoriesParams = {
      version: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW === 'true' ? 'draft' : 'published',
      language: locale,
    };

    try {
      const result = await client.getStory(fullSlug, params, { next: { revalidate: 0 } });
      if (!result?.data?.story) {
        return null;
      }
      return result as unknown as StoryblokStoryResult;
    } catch (_error) {
      this.logger.warn({ slug: fullSlug }, `Error fetching Storyblok story '${fullSlug}'`);
      return null;
    }
  }

  private token(): string {
    return process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim() ?? '';
  }

  private resolveSlug(slug: string, site?: string): string {
    if (process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE === 'true' && site) {
      return `${site}/${slug}`;
    }
    return slug;
  }

  private client(): StoryblokClient | null {
    const token = this.token();
    if (!token) {
      return null;
    }
    if (!this.accessor) {
      this.accessor = storyblokInit({
        accessToken: token,
        use: [apiPlugin],
        bridge: true,
        apiOptions: {
          maxRetries: 2,
          cache: { type: 'none' },
        },
      }) as unknown as StoryblokApiAccessor;
    }
    return this.accessor?.() ?? null;
  }
}

export default StoryblokCmsApi;
