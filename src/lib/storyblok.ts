import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';
import Article from '@/components/cms/article';
import Category from '@/components/cms/category';
import Columns from '@/components/cms/columns';
import ContentBlock from '@/components/cms/content-block';
import Feature from '@/components/cms/feature';
import Grid from '@/components/cms/grid';
import Logo from '@/components/cms/logo';
import MediaText from '@/components/cms/media-text';
import Navigation from '@/components/cms/navigation';
import Page from '@/components/cms/page';
import Segment from '@/components/cms/segment';
import {
  StoryblokButton,
  StoryblokColumnTeaser,
  StoryblokHero,
  StoryblokQuickEntry,
  StoryblokRecommendations,
} from '@/components/cms/storyblok/storyblok-component';
import Teaser from '@/components/cms/teaser';
import TopBannerAnnouncement from '@/components/cms/top-banner-announcement';
import Video from '@/components/cms/video';

/**
 * Initialize Storyblok client conditionally — only when an access token is
 * configured. Without a token the module returns a no-op accessor that
 * resolves to `null` (instead of crashing at module-load time inside
 * `storyblokInit`). Callers must treat the `null` case gracefully.
 *
 * Using RSC (React Server Components) approach.
 *
 * Note: we are not wrapping all Components for now.
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
      components: {
        feature: Feature,
        teaser: Teaser,
        grid: Grid,
        columns: Columns,
        page: Page,
        logo: Logo,
        navigation: Navigation,
        content_block: ContentBlock,
        category: Category,
        segment: Segment,
        article: Article,
        button: StoryblokButton,
        hero: StoryblokHero,
        quick_entry: StoryblokQuickEntry,
        media_text: MediaText,
        recommendations: StoryblokRecommendations,
        column_teaser: StoryblokColumnTeaser,
        video: Video,
        top_banner_announcement: TopBannerAnnouncement,
      },
    })
  : noopApi;
