import type { ContentSlotData } from './schema';

export type ContentSlotProps = ContentSlotData;

/**
 * Registry placeholder for the `content-slot` discriminator.
 *
 * `content-slot` has NO real renderer: `CmsRenderer` intercepts the
 * discriminator before the component-map lookup and substitutes the slot
 * with the threaded `pageBody[]`. This component therefore renders `null`
 * — it exists solely so the `cmsComponentMap` ↔ `CMSComponentSchema`
 * drift-guard stays in lock-step (every union member needs a map entry).
 *
 * If this component is ever actually mounted, it means the renderer reached
 * a slot it could not substitute (no `pageBody` in scope); rendering `null`
 * is the correct graceful degradation in that case.
 */
const ContentSlot = (_props: Readonly<ContentSlotProps>) => null;

export default ContentSlot;
