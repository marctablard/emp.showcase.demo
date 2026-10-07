/**
 * Drift guard — the slot-counting validator and the renderer walk the SAME
 * container tree.
 *
 * The single-`content-slot` invariant is split across two hand-maintained
 * lists: `countContentSlots()` (component-schema) descends through
 * `SLOT_CONTAINER_FIELDS`, while `CmsRenderer` substitutes slots while
 * recursing through `CONTAINER_CHILD_KEYS`. If a future container type adds a
 * new child-array field to the renderer but not to the validator, the
 * renderer would substitute a slot nested inside it while the validator never
 * counted it — silently admitting a second slot and rendering the page body
 * twice (the exact failure the `LayoutContentSchema` refine exists to
 * prevent).
 *
 * This guard pins the two field sets together, mirroring the existing
 * component-map ↔ union drift-guard discipline.
 */
import { SLOT_CONTAINER_FIELDS } from '../component-schema';
import { CONTAINER_CHILD_KEYS } from './cms-renderer';

describe('slot-container-fields drift guard', () => {
  const rendererFields = new Set<string>(Object.values(CONTAINER_CHILD_KEYS));
  const validatorFields = new Set<string>(SLOT_CONTAINER_FIELDS);

  it('every container child-key the renderer recurses through is counted by the slot validator', () => {
    const uncounted = [...rendererFields].filter((field) => !validatorFields.has(field));
    expect(uncounted).toEqual([]);
  });

  it('the validator does not count fields the renderer never recurses through (no dead entries)', () => {
    const orphan = [...validatorFields].filter((field) => !rendererFields.has(field));
    expect(orphan).toEqual([]);
  });
});
