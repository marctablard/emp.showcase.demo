import { z } from 'zod';
import { ArticleSchema } from './article/schema';
import { ButtonSchema } from './button/schema';
import { CategorySchema } from './category/schema';
import { ColumnTeaserSchema } from './column-teaser/schema';
import { ContentBlockSchema } from './content-block/schema';
import { ContentSlotSchema } from './content-slot/schema';
import { FeatureSchema } from './feature/schema';
import { HeroSchema } from './hero/schema';
import { LogoSchema } from './logo/schema';
import { MediaTextSchema } from './media-text/schema';
import { NavigationSchema } from './navigation/schema';
import { QuickEntrySchema } from './quick-entry/schema';
import { RecommendationsSchema } from './recommendations/schema';
import { RichtextSchema } from './richtext/schema';
import { TeaserSchema } from './teaser/schema';
import { TopBannerAnnouncementSchema } from './top-banner-announcement/schema';
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
 * Columns and Grid are recursive layout containers: their `columns` field
 * references the same discriminated union. Owned here alongside `PageSchema`
 * and `SegmentSchema` for the same load-time reason; the `<name>/schema.ts`
 * files re-export them for the conventional import path.
 */
export type ColumnsData = {
  id: string;
  type: 'columns';
  columns?: CMSComponent[];
};

export const ColumnsSchema: z.ZodObject<{
  id: z.ZodString;
  type: z.ZodLiteral<'columns'>;
  columns: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodTypeAny>>>;
}> = z.object({
  id: z.string(),
  type: z.literal('columns'),
  columns: z.array(z.lazy(() => CMSComponentSchema)).optional(),
});

export type GridData = {
  id: string;
  type: 'grid';
  columns?: CMSComponent[];
};

export const GridSchema: z.ZodObject<{
  id: z.ZodString;
  type: z.ZodLiteral<'grid'>;
  columns: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodTypeAny>>>;
}> = z.object({
  id: z.string(),
  type: z.literal('grid'),
  columns: z.array(z.lazy(() => CMSComponentSchema)).optional(),
});

/**
 * Layout is the per-page frame container fetched via `CmsAdapter.getLayout`.
 * Like `page`, its `body` field references the global discriminated union, so
 * a layout body can hold any registered component — including the
 * `content-slot` placeholder that marks where the page's own body is
 * substituted. Owned here alongside `PageSchema` for the same load-time
 * reason; `layout/schema.ts` re-exports it for the conventional import path.
 */
export type LayoutData = {
  id: string;
  type: 'layout';
  body: CMSComponent[];
};

export const LayoutSchema: z.ZodObject<{
  id: z.ZodString;
  type: z.ZodLiteral<'layout'>;
  body: z.ZodArray<z.ZodLazy<z.ZodTypeAny>>;
}> = z.object({
  id: z.string(),
  type: z.literal('layout'),
  body: z.array(z.lazy(() => CMSComponentSchema)),
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
  ColumnsSchema,
  ContentBlockSchema,
  ContentSlotSchema,
  FeatureSchema,
  GridSchema,
  HeroSchema,
  LayoutSchema,
  LogoSchema,
  MediaTextSchema,
  NavigationSchema,
  PageSchema,
  QuickEntrySchema,
  RecommendationsSchema,
  RichtextSchema,
  SegmentSchema,
  TeaserSchema,
  TopBannerAnnouncementSchema,
  VideoSchema,
]);

export type CMSComponent = z.infer<typeof CMSComponentSchema>;

/**
 * Recursive container fields a `content-slot` can be nested inside. Mirrors
 * the renderer's `CONTAINER_CHILD_KEYS` so the "exactly one slot" count and
 * the runtime substitution walk the same tree.
 *
 * Exported so the `slot-container-fields.drift.test.ts` guard can pin it
 * against the renderer's `CONTAINER_CHILD_KEYS`: if the two ever diverge, a
 * slot nested in a container the renderer substitutes but the validator does
 * not count would silently admit two slots (page body rendered twice).
 */
export const SLOT_CONTAINER_FIELDS = ['body', 'columns', 'content_blocks'] as const;

/**
 * Counts `content-slot` discriminators in a component array, descending
 * transitively through known container fields (`page`/`layout` body,
 * `columns`/`grid` columns, `segment` content_blocks). Used by
 * `LayoutContentSchema` to enforce the single-slot invariant.
 */
export function countContentSlots(components: ReadonlyArray<unknown>): number {
  let count = 0;
  for (const entry of components) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const node = entry as Record<string, unknown>;
    if (node.type === 'content-slot') {
      count += 1;
      continue;
    }
    for (const field of SLOT_CONTAINER_FIELDS) {
      const nested = node[field];
      if (Array.isArray(nested)) {
        count += countContentSlots(nested);
      }
    }
  }
  return count;
}

/**
 * Refined `layout` schema used at the `getLayout` boundary: a valid layout
 * holds EXACTLY ONE `content-slot` (counted transitively). Zero slots means
 * the page body would have nowhere to render; two or more would render the
 * page body twice. Both are validation errors.
 *
 * Kept separate from `LayoutSchema` (the union member) because `superRefine`
 * produces a `ZodEffects` wrapper that `z.discriminatedUnion` rejects.
 */
export const LayoutContentSchema = LayoutSchema.superRefine((layout, ctx) => {
  const slots = countContentSlots(layout.body);
  if (slots !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `A layout must contain exactly one content-slot (found ${slots})`,
    });
  }
});
