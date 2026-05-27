import { z } from 'zod';
import { ArticleSchema } from './article/schema';
import { ButtonSchema } from './button/schema';
import { CategorySchema } from './category/schema';
import { ColumnTeaserSchema } from './column-teaser/schema';
import { ContentBlockSchema } from './content-block/schema';
import { FeatureSchema } from './feature/schema';
import { HeroSchema } from './hero/schema';
import { LogoSchema } from './logo/schema';
import { QuickEntrySchema } from './quick-entry/schema';
import { RecommendationsSchema } from './recommendations/schema';
import { RichtextSchema } from './richtext/schema';
import { TeaserSchema } from './teaser/schema';
import { VideoSchema } from './video/schema';

/**
 * Page is the recursive container of CMS components: its `body` references
 * the global discriminated union, which itself contains PageSchema.
 *
 * The schema is owned here (rather than in `page/schema.ts`) to keep the
 * cycle inside a single module. `z.lazy(() => CMSComponentSchema)` defers
 * the cyclic reference until parse-time — at module load, the closure
 * captures the lexical binding but does not invoke it, so the discriminated
 * union below has a chance to be assigned before the first `parse()` call
 * reads through it.
 *
 * `page/schema.ts` re-exports `PageSchema` and `PageData` so consumers still
 * import from the conventional `<name>/schema.ts` location.
 *
 * The explicit `PageData` interface breaks the inference cycle that would
 * otherwise leave `body` typed as `unknown[]` (zod cannot infer the output
 * of a `z.lazy()` until the inner schema is bound).
 */

export type PageData = {
  id: string;
  type: 'page';
  title?: string;
  body: CMSComponent[];
};

export const PageSchema: z.ZodObject<{
  id: z.ZodString;
  type: z.ZodLiteral<'page'>;
  title: z.ZodOptional<z.ZodString>;
  body: z.ZodArray<z.ZodLazy<z.ZodTypeAny>>;
}> = z.object({
  id: z.string(),
  type: z.literal('page'),
  title: z.string().optional(),
  body: z.array(z.lazy(() => CMSComponentSchema)),
});

/**
 * Segment is a second recursive container: its `content_blocks` reference
 * the same discriminated union. Owned here alongside `PageSchema` for the
 * same load-time reason; `segment/schema.ts` re-exports it for the
 * conventional import path.
 */
export type SegmentData = {
  id: string;
  type: 'segment';
  segment_name?: string;
  emporix_segment_id?: string;
  site?: string;
  content_blocks?: CMSComponent[];
};

export const SegmentSchema: z.ZodObject<{
  id: z.ZodString;
  type: z.ZodLiteral<'segment'>;
  segment_name: z.ZodOptional<z.ZodString>;
  emporix_segment_id: z.ZodOptional<z.ZodString>;
  site: z.ZodOptional<z.ZodString>;
  content_blocks: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodTypeAny>>>;
}> = z.object({
  id: z.string(),
  type: z.literal('segment'),
  segment_name: z.string().optional(),
  emporix_segment_id: z.string().optional(),
  site: z.string().optional(),
  content_blocks: z.array(z.lazy(() => CMSComponentSchema)).optional(),
});

/**
 * Discriminated union of every registered CMS component schema.
 *
 * Adapters validate against this union at the CMS boundary; the renderer
 * consults `cmsComponentMap` (component-map.ts) for the matching React
 * component. The two surfaces stay in lock-step via the drift-guard
 * test in component-map.test.ts.
 *
 * Pure schema-aggregate: imports only `<name>/schema.ts` files (no React,
 * no .tsx) so the Domain layer can re-export `CMSComponent` from here
 * without dragging the UI tree along.
 */
export const CMSComponentSchema = z.discriminatedUnion('type', [
  ArticleSchema,
  ButtonSchema,
  CategorySchema,
  ColumnTeaserSchema,
  ContentBlockSchema,
  FeatureSchema,
  HeroSchema,
  LogoSchema,
  PageSchema,
  QuickEntrySchema,
  RecommendationsSchema,
  RichtextSchema,
  SegmentSchema,
  TeaserSchema,
  VideoSchema,
]);

export type CMSComponent = z.infer<typeof CMSComponentSchema>;
