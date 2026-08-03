---
name: slice4-test-paths
description: Slice-4 (Phase C) Storyblok adapter pipeline + map-renderer Pre-Impl test paths, jest-project routing, schema gap
metadata:
  type: project
---

Phase C / Slice 4 — StoryblokCmsAdapter + Map-Renderer. Failing acceptance tests committed on feature/SHOW-323 (commit 4e333071). All red (Cannot-find-module); baseline 976 stayed green.

**Test files + jest-project routing:**
- `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.test.ts` — Platform Tests (node, ts-jest). SDK `@storyblok/react/rsc` jest-mocked.
- `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` — Platform Tests.
- `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.contract.test.ts` — Platform Tests; reuses `runCmsAdapterContract`.
- `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.test.ts` — Platform Tests.
- `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.test.tsx` — Platform Tests but jsdom via `@jest-environment jsdom` docblock (NOT `components/` so not React-project; matched by `**/platform/**`).
- `src/components/cms/_core/cms-renderer.test.tsx` — React Tests (jsdom, RTL, next-intl/next-auth/product-tile mocks). `_core/` dir is NEW.

**Contracts pinned (slice-4 plan, NOT post-pivot source repo):**
- API `getStory(slug, locale, site?)`: lazy init once, token guard (NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN), multi-site `${site}/${slug}` via NEXT_PUBLIC_STORYBLOK_MULTI_SITE, env-driven preview version (NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW), `hasToken()`, `@injectable('StoryblokCmsApi')`. Returns raw SDK payload or null. NO Next-cache tags, NO getSpaceId (those are later phases E/F).
- Adapter: id='storyblok', `@injectable('CmsAdapter:storyblok')`, getPage→api.getStory→mapper.mapPage, getNavigation stub {notfound:true}, getEditableProps→data-blok-*, BridgeScript present (slice-4 SPI keeps it on adapter). hasContent delegates to api.hasToken.
- Mapper: `mapRichtext(node, id)` TipTap→RichtextData; `mapPage(story)` full body→components[] (component→type, _uid→id, richtext fields pre-mapped).
- BridgeScript: env-driven (mirrors legacy StoryblokProvider), renders null, 'use client'.
- CmsRenderer (_core): map lookup, recurse page/body|columns/columns|grid/columns|segment/content_blocks, unknown→null. NO content-slot/layout (those are Phase D).

**SCHEMA GAP — RESOLVED by architect (Option 2, maximal-robust), follow-up commit 05cb3f36:** Three-way diff (old showcase cbdd1dbe:richtext.tsx had BlockTypes.HR→<hr> + BR→<br> / Vorlage imported/SHOW-323:schema.ts has HrBlockSchema `{kind:'hr'}` + InlineBreakSchema `{kind:'br'}` / current narrow schema) showed the current schema LOST hr+br. Decision: extend richtext AST with `hr` block, `br` inline, plus proactively `underline`+`strike` boolean mark flags (analog to bold/italic/code — these two are OUR extension, not in Vorlage). richtext.test.tsx got +4 schema-parse + +4 render pins (<hr>/<br>/<u>/<s>). Mapper drop-pins for horizontal_rule/hard_break/underline/strike flipped DROP→MAPPED (a tightening). STILL dropped: highlight/superscript/subscript (no schema flag exists) + blockquote/image/code_block (no faithful agnostic mapping from TipTap payload). Marks remain boolean flags, not array form. Note: underline/strike parse-tests are real-failing because zod discriminatedUnion silently strips the unknown key → `undefined` (not a throw); render-tests fail on missing <u>/<s>.

**Source repo divergence:** imported/SHOW-323 is far ahead of slice-4 plan (preview retired, mapPageMetadata not mapPage, BridgeScript getter removed, getSpaceId, prop-driven bridge, STORYBLOK_ACCESS_TOKEN rename). Wrote against the slice-4 PLAN + showcase SPI, used source only as spec-by-example for matching shapes.
