# Local CMS

The `local` CMS provider serves content from version-controlled JSON files
instead of an external CMS. It is useful for development, demos, and running the
storefront without external dependencies. It is one of the interchangeable CMS
providers described in [cms-framework.md](./cms-framework.md); switching to it
requires no application-code change.

## Table of contents

1. [Overview](#overview)
2. [Content structure](#content-structure)
3. [Default-site fallback](#default-site-fallback)
4. [Content format](#content-format)
5. [Activating the local provider](#activating-the-local-provider)
6. [Adding content](#adding-content)

## Overview

The local provider is implemented by `LocalJsonCmsAdapter`
(`src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts`). Like every
provider it implements the `CmsAdapter` SPI and maps its source into the
agnostic `CMSPage` model, which then renders through the central `CmsRenderer`.
Because the application core is provider-agnostic, switching to `local` changes
only an environment variable — no imports are swapped and no code is edited.

## Content structure

Local content is stored as JSON under `src/data/cms/`, one file per page:

```
src/data/cms/<site>/<locale>/<slug>.json
```

- `<site>`: the site identifier (e.g. `main`, or `_default_` for the fallback).
- `<locale>`: the language code (e.g. `en`, `de`).
- `<slug>`: the page identifier (e.g. `home`, `about`).

The repository ships starter fixtures:

```
src/data/cms/_default_/en/home.json
src/data/cms/_default_/de/home.json
```

At request time `LocalJsonCmsAdapter.getPage` normalizes the slug (drops
disallowed characters, lowercases) and the locale (lowercases), and determines
the site from the current session's `siteCode`, falling back to the configured
default site.

## Default-site fallback

The default site is read from `NEXT_CMS_LOCAL_DEFAULT_SITE` and defaults
to `_default_` when unset. If a page is not found for the resolved site and that
site differs from the default, the adapter retries the lookup against the
default site:

```
src/data/cms/_default_/<locale>/<slug>.json
```

A missing file resolves to `{ notfound: true }`; the adapter never throws for
absent content. The page shell turns that into a Next.js `notFound()` (or an
empty spacer when `emptyOnNoResult` is set).

> Note: `getNavigation` is not backed by JSON and always resolves to
> `{ notfound: true }` for the local provider.

## Content format

Each JSON file is a `CMSPage`: a list of `components`, each carrying an `id`
and a `type` discriminator that must match a registered entry in
`src/components/cms/component-map.ts`. Component-specific fields are validated
against that component's Zod schema (see [ADR 0002](./adr/0002-cms-component-co-location-and-schema-first.md)).

```json
{
  "title": "Page title",
  "components": [
    {
      "id": "unique-component-id",
      "type": "hero"
    }
  ]
}
```

Refer to the shipped fixtures (`src/data/cms/_default_/en/home.json`) for a
complete, working example.

## Activating the local provider

Set the provider environment variable and restart the dev server:

```
NEXT_CMS_PROVIDER=local
```

This is resolved by `resolveCmsProvider` and binds `LocalJsonCmsAdapter` as the
active `CmsAdapter` (see [cms-framework.md](./cms-framework.md#provider-resolution)).
A restart (`npm run dev`) is required for new or changed JSON files to be picked
up.

## Adding content

1. Create a JSON file at `src/data/cms/<site>/<locale>/<slug>.json` (or under
   `_default_` to serve every site).
2. Follow the `CMSPage` format above, using component `type` values that exist
   in `component-map.ts`.
3. Restart the dev server.

To render a component `type` that does not exist yet, add a new CMS component
following the co-located, schema-first pattern in
[ADR 0002](./adr/0002-cms-component-co-location-and-schema-first.md) and
register it in `component-map.ts` / `component-schema.ts`. This is a content
concern shared by all providers, not specific to the local one.

## Related Documentation

- [Documentation index](./README.md)
- [CMS Framework](./cms-framework.md)
- [Creating Storyblok Components](./storyblok-components.md)
- [Environment Variables](./environment-variables.md)
