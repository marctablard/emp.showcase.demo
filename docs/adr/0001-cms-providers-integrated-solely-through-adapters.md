# 1. CMS providers are integrated solely through adapters

- Status: Accepted
- Date: 2026-05-27

## Context

The frontend originally hard-wired Storyblok: `storyblokInit()` ran at module load with a mandatory token, and Storyblok-specific code threaded through layouts, pages, hooks, providers, and component wrappers. Adding or swapping a CMS provider meant touching the application across many layers — and without a token the app crashed on startup.

The product goal is a CMS-agnostic storefront: Storyblok should be *one* of several interchangeable providers (alongside a local-JSON source for dev/demo and a null fallback for boot resilience), and onboarding a new provider (e.g. Contentful, Sanity) must not put the existing application at risk.

## Decision

**Integrating a new CMS provider requires writing only a new adapter. The application logic — the central renderer, the component map, the `CMSService` facade, and the UI layer — stays unchanged.**

Concretely:

- Adapters implement the `CmsAdapter` SPI: `hasContent()`, `getPage(slug, locale, site)`, `getNavigation(locale, site)`, plus the optional surface `getEditableProps?()` and `BridgeScript?`.
- An adapter is a **pure data translator**. It fetches from its provider and maps the provider-specific wire format into the agnostic `CMSPage` domain model via a dedicated mapper (e.g. `StoryblokCmsMapper` translates Storyblok's TipTap rich-text and story shape into `CMSPage`). An adapter contains **no render code**.
- The central `CmsRenderer` walks `CMSPage.body[]` and looks each component up in the `cmsComponentMap`. It renders every provider's content the same way — it has no knowledge of any provider.
- `getCmsService()` resolves the active `CMSService` and lazily binds the env-selected adapter on the current DI container instance (resilient to the Turbopack module-graph split — see the helper's documentation).

The set of providers is a typed `CMS_PROVIDER_IDS` tuple (`storyblok | local | none`). Adding one means: a new id entry, a new adapter folder under `src/platform/integrations/<name>/cms/impl/`, and nothing else in the application core.

## Consequences

- **Provider-specific concerns flow through the optional SPI, never through application code.** Storyblok's Visual-Editor outline (`data-blok-*`) comes from `getEditableProps()`; its live-preview bridge comes from `BridgeScript`. The renderer invokes these generically; a provider that needs neither simply omits them.
- **The agnostic `CMSPage` model must be expressive enough to represent any provider's content.** The translation burden sits in the adapter's mapper. Where a provider's wire format carries a construct the domain model does not express, the mapper drops or approximates it at the adapter boundary — the application never sees provider-shaped data.
- **This constraint is enforced as code, not just documented.** A drift-guard test (`src/components/cms/_core/renderer-provider-agnostic.drift.test.ts`) fails the build if the central renderer or page shell ever imports from `@/platform/integrations/*` or directly from a provider SDK.
- The rule generalises beyond CMS: any future swappable plugin axis (payment, search, …) follows the same shape — a new plugin is a new adapter, the application core stays untouched.

## Alternatives considered

**Provider-owned render path** (each adapter exposes `renderPage()` and renders its own content — Storyblok via its SDK `<StoryblokStory>` plus a registry of component wrappers). Rejected: it returns render responsibility to each adapter, which weakens provider-agnosticism (every new provider ships render logic, not just data mapping) and spreads UI concerns across the integration layer. The central-renderer approach keeps adapters as thin data translators and the render path single and shared, which satisfies the decision above more cleanly.
