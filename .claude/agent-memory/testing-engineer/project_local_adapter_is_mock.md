---
name: local-adapter-is-mock
description: The CMS "Local-JSON adapter" the ADR/plans reference is implemented as MockCmsAdapter (id `mock`), not a LocalJsonCmsAdapter. Plans sometimes name a non-existent path.
metadata:
  type: project
---

The ADR 0001 / SHOW-323 Slice-6.3 plans call the JSON-fixture-backed CMS adapter the **"Local-JSON adapter"** and the file-inventory names `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts` — but that file does NOT exist.

The adapter that actually exists is `MockCmsAdapter` at `src/platform/integrations/mock/cms/impl/MockCmsAdapter.ts` (`@injectable('CmsAdapter:mock')`, id `'mock'`). It loads `src/data/cms/<site>/<locale>/<slug>.json` via an injectable `CmsDataLoader` and is functionally the "Local-JSON adapter" the ADR describes.

**Why:** Slice-6.3 RE-CUT plan's file-inventory referenced `LocalJsonCmsAdapter` while the codebase has `MockCmsAdapter`. I targeted Pre-Impl `renderPage` tests at `MockCmsAdapter` and flagged the naming to the architect.

**How to apply:** When a CMS plan says "Local adapter" / "LocalJsonCmsAdapter", verify the path — it's almost certainly `MockCmsAdapter`. If a future slice actually renames it, the render-path tests follow. Don't write tests against a non-existent `LocalJsonCmsAdapter` path on the strength of the plan alone.
