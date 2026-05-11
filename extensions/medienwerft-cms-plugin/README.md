# Extension Guide (Emporix CMS Plugin)

> **Why this README is generic.** This file is intentionally a portable
> "how to implement and include a Storefront extension" guide so any team
> that receives this folder can get productive without reading the
> Emporix-specific product manual. For the CMS-specific setup, schemas,
> editor integration, live preview, theming, and troubleshooting, see
> [`INSTALLATION.md`](./INSTALLATION.md) and [`docs/`](./docs/).

This package is one concrete extension — it plugs the Emporix CMS Editor
into a Next.js storefront and provides visual page editing, a slot-based
layout system, dynamic themes, and a live preview iframe protocol. It
ships alongside the generic extension spec at
[`../README.md`](../README.md) and follows every convention described
there.

---

## 1. What is a Storefront extension?

A Storefront extension is a self-contained folder under
`extensions/<kebab-case-name>/` that:

- Registers DI-injectable services/integrations via `@injectable` that the
  core storefront will pick up at build time.
- Optionally aliases core service IDs (e.g. `CMSService → EmporixCMSService`)
  in its [`plugin.json`](./plugin.json).
- Optionally exports React components from `components/index.ts` so host
  code can `import { Foo } from '@extensions/<folder>/components'`.
- Optionally declares runtime schemas/seed data under `setup/`.
- Can define **contracts** (`*.d.ts` interfaces) that the host
  storefront must fulfil — Dependency Inversion at the extension
  boundary.

The full anatomy, naming rules, discovery mechanism, and best practices
are documented once in [`../README.md`](../README.md) — this file does
not repeat them.

## 2. How the storefront discovers this extension

1. Put the folder under `extensions/` (the directory name **is** the
   import path — `@extensions/medienwerft-cms-plugin/...`).
2. `plugin.json` is the manifest. The directory name and
   `manifest.name` should match (see `../README.md` → "plugin.json
   Manifest").
3. `npm run generate` scans every enabled extension with
   [`scripts/di-generator.ts`](../../scripts/di-generator.ts) and
   re-generates the DI container in `src/platform/`.
4. `aliases` in `plugin.json` become service overrides in the generated
   container — e.g. `CMSService: EmporixCMSService` means every caller
   that asks for `CMSService` gets our Emporix implementation.

No manual wiring is needed — just `npm run generate` after dropping
the extension in place.

## 3. Including an extension in a host app

A host application (or another extension) consumes this package in
three ways:

- **Use DI services via `@/platform/ssr` or `@/platform/client`:**
  ```ts
  import ssr from '@/platform/ssr';
  import type { EmporixCMSService } from '@extensions/medienwerft-cms-plugin/services/EmporixCMSService';

  const cms = ssr.get<EmporixCMSService>('EmporixCMSService');
  ```
- **Use the exported React components:**
  ```tsx
  import {
    EmporixCmsPage,
    EmporixContentSlot,
    EmporixCmsLayout,
  } from '@extensions/medienwerft-cms-plugin/components';
  ```
- **Fulfil the extension's contracts** — the extension declares `*.d.ts`
  interfaces under `services/` and `integrations/` that the host is
  expected to implement with an `@injectable('<Interface>', 'Singleton')`
  class in `src/`. This is how the storefront-specific component
  registry plugs in (`CMSComponentDefinitionService`). See
  [`INSTALLATION.md`](./INSTALLATION.md) for the concrete list.

## 4. Minimal extension skeleton ("hello world")

Any extension can stand up in three files:

```json
// extensions/my-extension/plugin.json
{
  "name": "my-extension",
  "description": "Minimal example extension",
  "version": "1.0.0",
  "enabled": true
}
```

```ts
// extensions/my-extension/services/impl/HelloService.ts
import { injectable } from '@/platform/core/di/injectable';

@injectable('HelloService', 'Singleton')
export class HelloService {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

export default HelloService;
```

```tsx
// extensions/my-extension/components/hello.tsx
export default function Hello({ name }: { name: string }) {
  return <span>Hello, {name}!</span>;
}
```

Then:

```bash
npm run generate
```

The extension is picked up on the next dev-server restart; its service is
available via DI and its components can be imported as
`@extensions/my-extension/components`.

## 5. This storefront ships with two CMS integrations

To avoid confusion when you see both in the repo:

- **Local JSON CMS** — storefront-side, lightweight, JSON-driven. Lives
  under `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` and the
  components under `src/components/cms/local/`. See
  [`docs/local-cms.md`](../../docs/local-cms.md) at the repo root. Not
  part of this extension.
- **Emporix CMS extension (this folder)** — external editor backed by
  Emporix Custom Entities, with live editor preview, draft/live
  versioning, slot-based layouts and dynamic per-site theming. See
  [`INSTALLATION.md`](./INSTALLATION.md).

Both can coexist — the DI container decides which `CMSService`
implementation is active based on the alias in [`plugin.json`](./plugin.json).

## 6. Distribution notes

This extension is tracked as a **nested Git repository** under
`extensions/medienwerft-cms-plugin/.git`. Host repositories typically
either:

- Add it as a **Git submodule** (`git submodule add <url> extensions/medienwerft-cms-plugin`),
- Import it with **`git subtree`** (vendored, no separate repo
  reference), or
- **Vendor** the files in-tree (drop the nested `.git`).

After pulling an update, re-run `npm run generate` so the storefront
picks up any new injectables or alias changes. Versioning and
release-channel details live in [`INSTALLATION.md`](./INSTALLATION.md#updating-the-extension).

## 7. Where to go next

- [`INSTALLATION.md`](./INSTALLATION.md) — CMS-specific setup: env
  vars, Tailwind `@source`, component registry, API-key auth,
  editor iframe/CORS, theming, troubleshooting.
- [`docs/architecture.md`](./docs/architecture.md) — architectural deep
  dive.
- [`docs/slot-based-architecture.md`](./docs/slot-based-architecture.md)
  — how slots are composed and rendered.
- [`docs/component-definition-service.md`](./docs/component-definition-service.md)
  — the host-implemented contract for component definitions.
- [`docs/component-definitions.md`](./docs/component-definitions.md)
  — authoring component definitions.
- [`docs/icon-selection.md`](./docs/icon-selection.md) — field-level
  icon picker for component props.
- [`../README.md`](../README.md) — the generic extension spec that
  governs every extension in this repo.
