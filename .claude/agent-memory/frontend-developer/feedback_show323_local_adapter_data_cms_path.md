---
name: feedback-show323-local-adapter-data-cms-path
description: SHOW-323 LocalJsonCmsAdapter default-loader `import()`-template path uses 5x `../`, not 6x. Slice-1 §11.A spec has an off-by-one — jest passes (loader is mocked), build crashes.
metadata:
  type: feedback
---

`LocalJsonCmsAdapter.ts` sits under `src/platform/integrations/local/cms/impl/` — exactly 5 levels below `src/`. The default webpack-context loader needs `../../../../../data/cms/${site}/${locale}/${slug}.json` (5x `..`), NOT 6x as the Slice-1 §11.A spec snippet shows.

**Why:** Jest doesn't catch this because tests inject a fake `CmsDataLoader` and never exercise the default loader. Only `next build` (which compiles the dynamic-import template as a webpack context module) surfaces the missing directory: `Module not found: Can't resolve '../../../../../../data/cms/' <dynamic> ...`.

**How to apply:** When porting / reimplementing CMS adapters from the source repo and the spec gives a `../../../../../../`-prefixed import template, count levels from the new file location to `src/` directly — do not trust the spec's prefix. Validate the path with a no-token `next build` as part of Phase-A verification, not just jest. The default-loader path is the one production line the test strategy intentionally does not cover.

Related: [[feedback-source-repo-as-spec-by-example]] — spec is a reference, not byte-for-byte source.
