/**
 * Unit tests for `NullCmsAdapter` — the default fallback bound to
 * `CmsAdapter` when no CMS provider is configured.
 *
 * Behaviour contract:
 * - `id === 'none'`
 * - `hasContent() === false`
 * - `getPage` / `getNavigation` resolve to `{ notfound: true }` and never reject
 * - optional surface (`getEditableProps`, `BridgeScript`) is NOT implemented
 *   on the instance (the facade falls back to `{}` / `null`).
 */
import type { CmsAdapter } from '../CmsAdapter';
import { NullCmsAdapter } from './NullCmsAdapter';

describe('NullCmsAdapter', () => {
  // Typed as the `CmsAdapter` SPI (not the concrete class) so the optional
  // surface (`getEditableProps?` / `BridgeScript?`) is reachable for the
  // "not implemented" assertions below.
  let adapter: CmsAdapter;

  beforeEach(() => {
    adapter = new NullCmsAdapter();
  });

  describe('identity', () => {
    it('reports the provider id "none"', () => {
      expect(adapter.id).toBe('none');
    });
  });

  describe('hasContent()', () => {
    it('returns false — the adapter never serves content', () => {
      expect(adapter.hasContent()).toBe(false);
    });
  });

  describe('getPage(slug, locale, site)', () => {
    it('resolves to a `notfound` result and includes the slug in the message', async () => {
      const result = await adapter.getPage('home', 'en', 'main');

      expect(result).toEqual(
        expect.objectContaining({
          notfound: true,
          message: expect.stringContaining('home'),
        }),
      );
    });

    it('does not reject for any slug — null adapter must surface no-content via `{ notfound: true }`', async () => {
      await expect(adapter.getPage('', 'en', 'main')).resolves.toBeDefined();
      await expect(adapter.getPage('whatever/with/slashes', 'fr', 'us-branch')).resolves.toBeDefined();
    });
  });

  describe('getNavigation(locale, site)', () => {
    it('resolves to `{ notfound: true }`', async () => {
      const result = await adapter.getNavigation('en', 'main');

      expect(result).toEqual(expect.objectContaining({ notfound: true }));
    });
  });

  describe('optional surface', () => {
    it('does NOT implement `getEditableProps` — the facade falls back to `{}`', () => {
      expect(adapter.getEditableProps).toBeUndefined();
    });

    it('does NOT implement `BridgeScript` — the facade falls back to `null`', () => {
      expect(adapter.BridgeScript).toBeUndefined();
    });
  });
});
