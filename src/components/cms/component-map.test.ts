/**
 * Drift-guard for the CMS component registry.
 *
 * The component map (`cmsComponentMap`) and the global discriminated union
 * (`CMSComponentSchema`) must stay in lock-step:
 *
 * - every map-key has a matching schema entry in the union (so the renderer
 *   never looks up a component that no adapter can validate),
 * - every union member has a matching map entry (so a schema-registered
 *   component is always renderable).
 *
 * If either side gains or loses a component without the other, this suite
 * fails — catching the most common registry-extension mistake at
 * compile + test time rather than at runtime when a page is loaded.
 *
 * The registry surfaces (`component-map.ts`, `component-schema.ts`) do not
 * exist yet — this suite is red until the foundation lands.
 */
import type { z } from 'zod';
import { type CmsComponentMapKey, cmsComponentMap } from './component-map';
import { CMSComponentSchema } from './component-schema';

type DiscriminatedOption = z.ZodObject<{ type: z.ZodLiteral<string> }>;

function getSchemaKeys(): string[] {
  // `discriminatedUnion` exposes its member schemas via `.options`. Each
  // option is a `ZodObject` with a `type` field that is a `ZodLiteral`.
  const schema = CMSComponentSchema as unknown as {
    options: readonly DiscriminatedOption[];
  };
  return schema.options.map((option) => {
    const typeField = option.shape.type;
    return typeField._def.value;
  });
}

describe('cmsComponentMap drift-guard', () => {
  it('every map-key has a matching schema in CMSComponentSchema', () => {
    const mapKeys = Object.keys(cmsComponentMap);
    const schemaKeys = getSchemaKeys();

    const orphans = mapKeys.filter((key) => !schemaKeys.includes(key));
    expect(orphans).toEqual([]);
  });

  it('every CMSComponentSchema member has a matching map entry', () => {
    const mapKeys = Object.keys(cmsComponentMap);
    const schemaKeys = getSchemaKeys();

    const orphans = schemaKeys.filter((key) => !mapKeys.includes(key));
    expect(orphans).toEqual([]);
  });

  it('each map entry exposes a `component` (React) and a `schema` (Zod)', () => {
    for (const key of Object.keys(cmsComponentMap) as CmsComponentMapKey[]) {
      const entry = cmsComponentMap[key];
      // Component can be a function (FC), an object (forwardRef/memo wrapper),
      // or a class — but never null/undefined.
      expect(entry.component).toBeDefined();
      expect(entry.schema).toBeDefined();
      expect(typeof entry.schema.parse).toBe('function');
    }
  });

  it('every map entry`s schema discriminator-literal equals its map key', () => {
    /*
     * Catches mis-wired entries like
     *   cmsComponentMap = { hero: { component: Hero, schema: ButtonSchema } }
     * where the key-set drift-guard above stays green even though the
     * schema and map-key disagree on the discriminator.
     */
    for (const [key, entry] of Object.entries(cmsComponentMap)) {
      const schema = entry.schema as unknown as {
        shape: { type: { _def: { value: string } } };
      };
      const discriminator = schema.shape.type._def.value;
      expect(discriminator).toBe(key);
    }
  });

  it('registers the five pilot components', () => {
    /*
     * Pins the foundation inventory explicitly: button, hero, content-block,
     * richtext, page. The drift-guard above keeps map/union in lock-step;
     * this list pins the explicit expectation so accidentally dropping a
     * pilot registration surfaces here. When the remaining default
     * components are registered in a later registration, this list extends
     * (a legitimate contract tightening, not a loosening).
     */
    const expected = ['button', 'content-block', 'hero', 'page', 'richtext'];
    const actual = Object.keys(cmsComponentMap).sort();

    expect(actual).toEqual(expected);
  });
});
