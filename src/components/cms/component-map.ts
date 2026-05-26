import Button, { ButtonSchema } from './button';
import { PageSchema } from './component-schema';
import ContentBlock, { ContentBlockSchema } from './content-block';
import Hero, { HeroSchema } from './hero';
import Page from './page';
import Richtext, { RichtextSchema } from './richtext';

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
  button: { component: Button, schema: ButtonSchema },
  'content-block': { component: ContentBlock, schema: ContentBlockSchema },
  hero: { component: Hero, schema: HeroSchema },
  page: { component: Page, schema: PageSchema },
  richtext: { component: Richtext, schema: RichtextSchema },
} as const;

export type CmsComponentMap = typeof cmsComponentMap;
export type CmsComponentMapKey = keyof CmsComponentMap;
