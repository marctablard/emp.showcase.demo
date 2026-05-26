# Jest Module Mocks

Module-level mocks wired in via `moduleNameMapper` in `jest.config.js`.

| Mock | Purpose | Scope |
|------|---------|-------|
| `server-only.js` | The real `server-only` package throws outside the Next bundler; the stub returns an empty object so side-effect imports stay no-ops in tests. | All Jest projects (`commonJestConfig`) |
| `next-auth-react.js` | `next-auth/react` is ESM-only and trips the Jest CJS pipeline. The stub returns inert hook/function placeholders that satisfy import chains reaching it transitively (`useCart` -> `ProductTile` -> recommendations carousel). Tests that need real behaviour can still call `jest.mock('next-auth/react')` with their own fixtures. | `React Tests` only — narrow so Platform/Library tests see the real module path |
| `product-tile.js` | The real `ProductTile` transitively pulls in `useL10n`/`useSiteStore`, which require the full Zustand `StoreProvider`. The stub returns a marker `<div>` so the CMS-component tests can hydrate the surrounding tree without standing up the provider stack. | `React Tests` only — CMS-component tests do not assert on tile internals |
| `product-tile-skeleton.js` | Same reasoning as `product-tile.js` but for the skeleton-loader variant. | `React Tests` only |

Tests that need real behaviour for any of these modules should override the mapping inside the test file via `jest.mock(...)`.
