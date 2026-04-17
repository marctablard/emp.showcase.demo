import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { ISbStoriesParams, StoryblokClient } from '@storyblok/react/rsc';
import { StoryblokStory } from '@storyblok/react/rsc';
import type { BreadcrumbContent } from '@/lib/breadcrumb';
import { getStoryblokApi } from '@/lib/storyblok';
import { UiBreadcrumb } from '../../ui/molecules/ui-breadcrumb';

interface CMSPageParams {
  slug: string;
  locale: string;
  site?: string;
  emptyOnNoResult?: boolean;
}
export const fetchData = cache(async (locale: string, slug: string, site?: string) => {
  const sbParams: ISbStoriesParams = {
    version: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW === 'true' ? 'draft' : 'published',
    language: locale,
  };
  if (process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE === 'true' && site) {
    slug = `${site}/${slug}`;
  }
  try {
    const storyblokApi: StoryblokClient = getStoryblokApi();
    return await storyblokApi.getStory(slug, sbParams, { next: { revalidate: 0 } });
  } catch {
    return null;
  }
});

const buildBreadcrumb = async (slug: string, locale: string): Promise<BreadcrumbContent[]> => {
  let subSlug = slug;
  const result: BreadcrumbContent[] = [];
  while (subSlug.length > 0) {
    const subData = await fetchData(locale, subSlug);
    if (subData?.data?.story) {
      result.push({
        href: `/${subSlug}`,
        label: subData.data.story.name,
      });
    }
    const ix = subSlug.lastIndexOf('/');
    if (ix === -1) {
      break;
    }
    subSlug = subSlug.substring(ix);
  }
  return result;
};

/**
 * Storyblok Demo Page
 * Fetches and displays content from Storyblok using server components
 */
export default async function CMSPageComponent({ slug, locale, site, emptyOnNoResult }: CMSPageParams) {
  const subData = await fetchData(locale, slug, site);
  if (!subData?.data?.story) {
    if (emptyOnNoResult) {
      return (
        <>
          <div className="flex-grow mt-17 sm:mt-36 md:mt-52"></div>
        </>
      );
    }
    notFound();
  }
  let breadcrumb: BreadcrumbContent[] = [];
  if (!subData?.data?.story.content.no_margin) {
    breadcrumb = await buildBreadcrumb(slug, locale);
  }

  return (
    <>
      <div className={subData?.data?.story.content.no_margin ? '' : 'flex-grow mt-17 sm:mt-36 md:mt-52'}>
        {breadcrumb.length > 0 && (
          <UiBreadcrumb items={breadcrumb} className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6" />
        )}
        <StoryblokStory story={subData?.data?.story} />
      </div>
    </>
  );
}
