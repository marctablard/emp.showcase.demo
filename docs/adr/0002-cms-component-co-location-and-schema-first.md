# 2. CMS components are co-located and schema-first

- Status: Accepted
- Date: 2026-05-27

## Context

The CMS component layer holds 20 render components (hero, button, content-block, richtext, page, article, …). They are populated by adapter-supplied, untrusted CMS data and rendered through a single central renderer (see ADR 0001). Without a uniform structure the layer drifts: inconsistent prop typing, ad-hoc validation, render components diverging from the data contract, and a component silently missing from the renderer's lookup map.

## Decision

**Every CMS component follows a fixed co-location structure with a schema-first contract.**

Folder per component — `src/components/cms/<name>/`:

- `schema.ts` — the Zod schema. **React-free** (imports only `zod` and other `schema.ts` files). Exports `<Name>Schema` and `<Name>Data` (`z.infer<typeof <Name>Schema>`).
- `<name>.tsx` — the component. `<Name>Props = <Name>Data & HTMLAttributes<HTMLElement>`. Spreads `...rest` onto the single root element, merges `className` via `cn()`. Default export `<Name>`.
- `<name>.test.tsx` — schema-parse tests (valid / missing-required / wrong-discriminator) and a spread test (`data-*` reaches the root, `className` merges).
- `index.ts` — re-exports `<Name>` / `<Name>Props` / `<Name>Schema` / `<Name>Data`.

Cross-cutting:

- **Server-first.** A component is a Server Component by default. Browser-only logic (hooks, event handlers, browser APIs) is extracted into a `'use client'` island (`<name>-<concern>.tsx`); the server parent composes it. The audit also covers module-subgraph triggers — e.g. importing `Link` from `@/i18n/navigation` pulls a client-only factory, which forces an island even without local hooks.
- **Registration.** Each component is registered in `component-map.ts` (component + schema per discriminator) and in `component-schema.ts` (`CMSComponentSchema`, a Zod `discriminatedUnion`). A drift-guard test keeps map and union in lock-step — a forgotten registration on either side fails the build.
- **Recursive containers** (`page`, `columns`, `grid`, `segment`) reference their children via `z.lazy(() => CMSComponentSchema)`; their schema is co-located in `component-schema.ts` to break the ES-module initialization cycle (TDZ-safe).

## Consequences

- Adding a CMS component is a predictable, mechanical set of files; a reviewer knows exactly what to expect.
- Adapter-supplied data is validated at the schema boundary before it reaches a component; the render layer is type-safe end to end (`CMSComponent` is derived from the discriminated union, not `[key: string]: any`).
- The drift guard makes "component exists but isn't renderable" (or vice versa) a build failure rather than a runtime blank.
- Trade-off: more boilerplate per component (four files, four identifiers) than a single flat file. This is accepted deliberately — the uniformity and the compile- and test-time guarantees outweigh the extra files, especially for a showcase codebase meant to demonstrate engineering structure.
