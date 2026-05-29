import { z } from 'zod';

/**
 * Content-slot is a placeholder discriminator, NOT a renderable component.
 *
 * It marks the single position inside a `layout` where the page's own
 * `body[]` (the `pageBody` prop threaded through `CmsRenderer`) is
 * substituted at render time. The renderer special-cases `content-slot`
 * BEFORE the component-map lookup, so the registered component
 * (`content-slot/content-slot.tsx`) only exists to satisfy the
 * map↔union drift-guard — it is never the render path.
 *
 * The schema is a pure leaf (no recursive fields): a slot carries only its
 * identity and discriminator. Its membership in the global
 * `CMSComponentSchema` union is what lets a `layout.body[]` — and any
 * transitive container nested inside it (`columns`, `grid`, `segment`) —
 * validate a slot entry.
 */
export const ContentSlotSchema = z.object({
  id: z.string(),
  type: z.literal('content-slot'),
});

export type ContentSlotData = z.infer<typeof ContentSlotSchema>;
