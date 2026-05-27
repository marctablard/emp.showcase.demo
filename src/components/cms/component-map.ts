import Article, { ArticleSchema } from './article';
import Button, { ButtonSchema } from './button';
import Category, { CategorySchema } from './category';
import ColumnTeaser, { ColumnTeaserSchema } from './column-teaser';
import { PageSchema } from './component-schema';
import ContentBlock, { ContentBlockSchema } from './content-block';
import Feature, { FeatureSchema } from './feature';
import Hero, { HeroSchema } from './hero';
import Logo, { LogoSchema } from './logo';
import Page from './page';
import QuickEntry, { QuickEntrySchema } from './quick-entry';
import Recommendations, { RecommendationsSchema } from './recommendations';
import Richtext, { RichtextSchema } from './richtext';
import Segment, { SegmentSchema } from './segment';
import Teaser, { TeaserSchema } from './teaser';
import Video, { VideoSchema } from './video';

/**
 * Registry mapping each CMS component's discriminator string to the
 * paired React component + Zod schema. Adapters validate incoming
 * payloads against `schema`; the renderer mounts `component`.
 *
 * The drift-guard test in `component-map.test.ts` pins every map key
 * against the `CMSComponentSchema` discriminated union so adding a
 * schema without a component (or vice versa) fails fast.
 *
 * Schema-only consumers (Domain layer, integration adapters) should
 * import from `./component-schema` instead — this file pulls the full
 * React component graph in.
 */
export const cmsComponentMap = {
  article: { component: Article, schema: ArticleSchema },
  button: { component: Button, schema: ButtonSchema },
  category: { component: Category, schema: CategorySchema },
  'column-teaser': { component: ColumnTeaser, schema: ColumnTeaserSchema },
  'content-block': { component: ContentBlock, schema: ContentBlockSchema },
  feature: { component: Feature, schema: FeatureSchema },
  hero: { component: Hero, schema: HeroSchema },
  logo: { component: Logo, schema: LogoSchema },
  page: { component: Page, schema: PageSchema },
  'quick-entry': { component: QuickEntry, schema: QuickEntrySchema },
  recommendations: { component: Recommendations, schema: RecommendationsSchema },
  richtext: { component: Richtext, schema: RichtextSchema },
  segment: { component: Segment, schema: SegmentSchema },
  teaser: { component: Teaser, schema: TeaserSchema },
  video: { component: Video, schema: VideoSchema },
} as const;

export type CmsComponentMap = typeof cmsComponentMap;
export type CmsComponentMapKey = keyof CmsComponentMap;
