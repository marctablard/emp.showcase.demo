/**
 * Unit tests for `DelegatingCmsServiceSSR` — the single `CMSService` facade impl.
 *
 * Behaviour contract:
 * - Every accessor delegates 1:1 to the injected `CmsAdapter` with the same args.
 * - `providerId` reflects `adapter.id`.
 * - `hasContent()` reflects `adapter.hasContent()`.
 * - When the adapter omits the optional surface, the facade falls back to
 *   `{}` for `getEditableProps` and `null` for `BridgeScript` — adapters
 *   never see this fallback, the facade does.
 */
import type { ComponentType, HTMLAttributes } from 'react';
import type { CMSComponent, CMSLayout, CMSNavigation, CMSNoResult, CMSPage } from '../../model/cms';
import type { CmsAdapter } from '../CmsAdapter';
import { DelegatingCmsServiceSSR } from './DelegatingCmsServiceSSR';

const SAMPLE_PAGE: CMSPage = {
  title: 'Home',
  description: 'Landing',
  url: '/',
  components: [],
};
const SAMPLE_LAYOUT: CMSLayout = {
  id: 'layout-1',
  type: 'layout',
  body: [{ id: 'slot-1', type: 'content-slot' }],
};
const SAMPLE_NAV: CMSNavigation = { items: [{ title: 'Shop', href: '/shop' }] };
const SAMPLE_COMPONENT: CMSComponent = {
  id: 'c1',
  type: 'button',
  title: 'Buy',
  link: '/',
};

function buildAdapter(overrides: Partial<CmsAdapter> = {}): jest.Mocked<CmsAdapter> {
  const base: CmsAdapter = {
    id: 'none',
    hasContent: jest.fn(() => true),
    getPage: jest.fn(async () => SAMPLE_PAGE),
    getLayout: jest.fn(async () => SAMPLE_LAYOUT),
    getNavigation: jest.fn(async () => SAMPLE_NAV),
    ...overrides,
  };
  return base as jest.Mocked<CmsAdapter>;
}

describe('DelegatingCmsServiceSSR', () => {
  describe('providerId', () => {
    it('reflects the adapter id', () => {
      const adapter = buildAdapter({ id: 'storyblok' });
      const service = new DelegatingCmsServiceSSR(adapter);

      expect(service.providerId).toBe('storyblok');
    });

    it('updates when the adapter advertises a different id (Null vs Local vs Storyblok)', () => {
      const local = buildAdapter({ id: 'local' });
      const none = buildAdapter({ id: 'none' });

      expect(new DelegatingCmsServiceSSR(local).providerId).toBe('local');
      expect(new DelegatingCmsServiceSSR(none).providerId).toBe('none');
    });
  });

  describe('hasContent()', () => {
    it('delegates to the adapter and forwards the result', () => {
      const adapter = buildAdapter({ hasContent: jest.fn(() => false) });
      const service = new DelegatingCmsServiceSSR(adapter);

      expect(service.hasContent()).toBe(false);
      expect(adapter.hasContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPage / getNavigation', () => {
    it('forwards getPage args (slug, locale, site) and resolves to the adapter result', async () => {
      const adapter = buildAdapter();
      const service = new DelegatingCmsServiceSSR(adapter);

      const result = await service.getPage('home', 'de', 'main');

      expect(adapter.getPage).toHaveBeenCalledWith('home', 'de', 'main');
      expect(adapter.getPage).toHaveBeenCalledTimes(1);
      expect(result).toBe(SAMPLE_PAGE);
    });

    it('forwards getNavigation args (locale, site) and resolves to the adapter result', async () => {
      const adapter = buildAdapter();
      const service = new DelegatingCmsServiceSSR(adapter);

      const result = await service.getNavigation('de', 'main');

      expect(adapter.getNavigation).toHaveBeenCalledWith('de', 'main');
      expect(result).toBe(SAMPLE_NAV);
    });

    it('propagates `{ notfound: true }` results unchanged (Null/Local stubs)', async () => {
      const notFound: CMSNoResult = { notfound: true };
      const adapter = buildAdapter({
        getPage: jest.fn(async () => notFound),
        getNavigation: jest.fn(async () => notFound),
      });
      const service = new DelegatingCmsServiceSSR(adapter);

      await expect(service.getPage('x', 'en', 'main')).resolves.toEqual(notFound);
      await expect(service.getNavigation('en', 'main')).resolves.toEqual(notFound);
    });
  });

  describe('getEditableProps()', () => {
    it('delegates to the adapter when implemented and returns the adapter result verbatim', () => {
      const editableProps: HTMLAttributes<HTMLElement> = { id: 'editable-root' };
      const getEditableProps: NonNullable<CmsAdapter['getEditableProps']> = jest.fn(() => editableProps);
      const adapter = buildAdapter({ getEditableProps });
      const service = new DelegatingCmsServiceSSR(adapter);

      const result = service.getEditableProps(SAMPLE_COMPONENT);

      expect(adapter.getEditableProps).toHaveBeenCalledWith(SAMPLE_COMPONENT);
      expect(result).toBe(editableProps);
    });

    it('falls back to an empty object `{}` when the adapter omits `getEditableProps`', () => {
      const adapter = buildAdapter(); // no getEditableProps
      const service = new DelegatingCmsServiceSSR(adapter);

      const result = service.getEditableProps(SAMPLE_COMPONENT);

      expect(result).toEqual({});
    });
  });

  describe('BridgeScript', () => {
    it('exposes the adapter `BridgeScript` when present', () => {
      const Bridge: ComponentType = () => null;
      const adapter = buildAdapter({ BridgeScript: Bridge });
      const service = new DelegatingCmsServiceSSR(adapter);

      expect(service.BridgeScript).toBe(Bridge);
    });

    it('returns `null` (not undefined) when the adapter omits `BridgeScript`', () => {
      const adapter = buildAdapter(); // no BridgeScript
      const service = new DelegatingCmsServiceSSR(adapter);

      expect(service.BridgeScript).toBeNull();
    });
  });
});
