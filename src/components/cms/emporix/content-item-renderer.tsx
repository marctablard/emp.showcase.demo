import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { getCurrentContentPageId } from '@/lib/ssr/content-page';
import { getCurrentContentSiteId } from '@/lib/ssr/content-site';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type { ContentItem, ContentItemsService } from '@/platform/services/contentitems/ContentItemsService';
import ssr from '@/platform/ssr';
import type { ButtonData } from '../button';
import type { VideoData } from '../video';
import ContentItemCentered from './content-item-centered';
import styles from './content-item-hero.module.css';
import type { ImagePosition } from './content-item-media-text';
import ContentItemMediaText from './content-item-media-text';
import ContentItemProductHighlights from './content-item-product-highlights';
import type { TextEditorData } from './hero';
import Hero from './hero';

/**
 * Fetch a media asset URL by its Emporix media ID
 */
const fetchMediaUrl = cache(async (mediaId: string): Promise<string | null> => {
  try {
    const apiInvoker = ssr.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = ssr.get<EmporixConfig>('EmporixConfig');

    const response = await apiInvoker.authenticatedFetch(
      `/media/${config.tenant}/assets/${mediaId}`,
      { method: 'GET' },
      'service',
    );

    if (!response.ok) return null;
    const media = await response.json();
    return media.url || null;
  } catch {
    return null;
  }
});

/**
 * Build description text from the ContentItem's multilingual description array
 */
function resolveDescription(descriptions: Array<{ language: string; value: string }>, locale: string): string {
  return (
    descriptions.find((d) => d.language === locale)?.value ||
    descriptions.find((d) => d.language === 'en')?.value ||
    descriptions[0]?.value ||
    ''
  );
}

/**
 * Build a TextEditorData object from a plain text string
 */
function buildTextEditorData(text: string): TextEditorData {
  return {
    content: [{ text, type: 'paragraph', content: [{ text }] }],
  };
}

async function mapToHeroProps(
  contentItem: ContentItem,
  locale: string,
): Promise<{
  headline: string;
  text: TextEditorData;
  main_button: ButtonData[];
  image: { filename: string; alt?: string };
  video?: VideoData[];
  showOverlay: boolean;
} | null> {
  const headline =
    contentItem.name?.[locale] ||
    contentItem.name?.['en'] ||
    contentItem.name?.[Object.keys(contentItem.name || {})[0]] ||
    '';

  const descriptions = contentItem.mixins?.content?.description || [];
  const descriptionText = resolveDescription(descriptions, locale);
  const hasDescriptionInLocale = descriptions.some((d) => d.language === locale && d.value?.trim());

  const buttonLink = contentItem.mixins?.content?.buttonlink;
  const main_button: ButtonData[] = buttonLink
    ? [{ title: 'Learn More', link: buttonLink, iconRight: 'ArrowRight' }]
    : [];

  const mediaId = contentItem.media?.[0];
  if (!headline || !mediaId) return null;

  const mediaUrl = await fetchMediaUrl(mediaId);
  if (!mediaUrl) return null;

  return {
    headline,
    text: buildTextEditorData(descriptionText),
    main_button,
    image: { filename: mediaUrl, alt: contentItem.name?.['en'] || '' },
    showOverlay: hasDescriptionInLocale,
  };
}

async function mapToMediaTextProps(
  contentItem: ContentItem,
  locale: string,
  imagePosition: ImagePosition | 'Left' | 'Right',
): Promise<{
  headline: string;
  text: TextEditorData;
  main_button: ButtonData[];
  image: { filename: string; alt?: string };
  video?: VideoData[];
  has_background?: boolean;
  image_position: ImagePosition | 'Left' | 'Right';
} | null> {
  const headline =
    contentItem.name?.[locale] ||
    contentItem.name?.['en'] ||
    contentItem.name?.[Object.keys(contentItem.name || {})[0]] ||
    '';

  const descriptions = contentItem.mixins?.content?.description || [];
  const descriptionText = resolveDescription(descriptions, locale);
  const buttonLink = contentItem.mixins?.content?.buttonlink;
  const main_button: ButtonData[] = buttonLink
    ? [{ title: 'Learn More', link: buttonLink, iconRight: 'ArrowRight' }]
    : [];

  const mediaId = contentItem.media?.[0];
  if (!headline || !mediaId) return null;

  const mediaUrl = await fetchMediaUrl(mediaId);
  if (!mediaUrl) return null;

  return {
    headline,
    text: buildTextEditorData(descriptionText),
    main_button,
    image: { filename: mediaUrl, alt: contentItem.name?.[locale] || contentItem.name?.['en'] || '' },
    has_background: (contentItem.mixins?.style as any)?.has_background || false,
    image_position: imagePosition,
  };
}

async function mapToCenteredProps(
  contentItem: ContentItem,
  locale: string,
): Promise<{
  headline?: string;
  text?: TextEditorData;
  main_button?: ButtonData[];
  image: { filename: string; alt?: string };
} | null> {
  const headline =
    contentItem.name?.[locale] ||
    contentItem.name?.['en'] ||
    contentItem.name?.[Object.keys(contentItem.name || {})[0]] ||
    '';

  const descriptions = contentItem.mixins?.content?.description || [];
  const descriptionText = resolveDescription(descriptions, locale);
  const buttonLink = contentItem.mixins?.content?.buttonlink;
  const main_button: ButtonData[] | undefined = buttonLink
    ? [{ title: 'Learn More', link: buttonLink, iconRight: 'ArrowRight' }]
    : undefined;

  const mediaId = contentItem.media?.[0];
  if (!mediaId) return null;

  const mediaUrl = await fetchMediaUrl(mediaId);
  if (!mediaUrl) return null;

  return {
    headline: headline || undefined,
    text: descriptionText ? buildTextEditorData(descriptionText) : undefined,
    main_button,
    image: { filename: mediaUrl, alt: contentItem.name?.[locale] || contentItem.name?.['en'] || '' },
  };
}

/**
 * Render a single ContentItem as a React component based on its display type
 */
export async function renderContentItem(
  contentItem: ContentItem,
  locale: string,
  isFirstOnPage = false,
): Promise<React.ReactElement | null> {
  const displayType = contentItem.mixins?.style?.display || 'hero';

  switch (displayType) {
    case 'hero': {
      const props = await mapToHeroProps(contentItem, locale);
      if (!props) return null;
      return (
        <div key={contentItem.id} className={styles.contentItemHeroContainer}>
          <Hero {...props} />
        </div>
      );
    }
    case 'image left': {
      const props = await mapToMediaTextProps(contentItem, locale, 'Left' as ImagePosition);
      if (!props) return null;
      return <ContentItemMediaText key={contentItem.id} {...props} isFirstOnPage={isFirstOnPage} />;
    }
    case 'image right': {
      const props = await mapToMediaTextProps(contentItem, locale, 'Right' as ImagePosition);
      if (!props) return null;
      return <ContentItemMediaText key={contentItem.id} {...props} isFirstOnPage={isFirstOnPage} />;
    }
    case 'centered': {
      const props = await mapToCenteredProps(contentItem, locale);
      if (!props) return null;
      return <ContentItemCentered key={contentItem.id} {...props} isFirstOnPage={isFirstOnPage} />;
    }
    default: {
      const props = await mapToHeroProps(contentItem, locale);
      if (!props) return null;
      return (
        <div key={contentItem.id} className={styles.contentItemHeroContainer}>
          <Hero {...props} />
        </div>
      );
    }
  }
}

/**
 * Render an array of ContentItems, resolving locale automatically
 */
export async function renderContentItems(
  contentItems: ContentItem[],
  isHomepage = false,
): Promise<React.ReactElement[]> {
  const locale = await getLocale();
  const components = await Promise.all(
    contentItems.map((item, index) => renderContentItem(item, locale, isHomepage && index === 0)),
  );
  return components.filter((c): c is React.ReactElement => c !== null);
}

/**
 * ContentItemHero - server component that fetches and renders content items
 * for the current CONTENTSITE + CONTENTPAGE combination.
 */
const fetchContentItems = cache(async (siteId: string, pageId: string, productId?: string) => {
  const contentItemsService = ssr.get<ContentItemsService>('ContentItemsService');
  const query: { siteId: string; pageId: string; productId?: string; size: number } = {
    siteId,
    pageId,
    size: 100,
  };
  if (productId) query.productId = productId;
  const result = await contentItemsService.getContentItems(query);
  return result.items;
});

export default async function ContentItemHero({ pathname, productId }: { pathname: string; productId?: string }) {
  const siteId = await getCurrentContentSiteId();
  const pageId = await getCurrentContentPageId(pathname);

  if (!siteId || !pageId) return null;

  const contentItems = await fetchContentItems(siteId, pageId, productId);
  if (contentItems.length === 0) return null;

  const locale = await getLocale();
  const isHomepage = pathname === '/' || pathname === '';

  const components = await Promise.all(
    contentItems.map((item, index) => renderContentItem(item, locale, isHomepage && index === 0)),
  );

  const rendered = components.filter((c): c is React.ReactElement => c !== null);
  if (rendered.length === 0) return null;

  return <>{rendered}</>;
}

export { ContentItemProductHighlights };
