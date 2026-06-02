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
import { __resetCmsCache } from '../cms-cache';
import { DelegatingCmsServiceSSR } from './DelegatingCmsServiceSSR';

beforeEach(() => {
  // The read-through cache is globalThis-backed; reset it so each test starts cold.
  __resetCmsCache();
});

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

describe('DelegatingCmsServiceSSR — read-through cache', () => {
  it('calls the adapter exactly once for two consecutive getPage(slug, locale, site)', async () => {
    const adapter = buildAdapter();
    const service = new DelegatingCmsServiceSSR(adapter);

    await service.getPage('home', 'de', 'main');
    const second = await service.getPage('home', 'de', 'main');

    expect(adapter.getPage).toHaveBeenCalledTimes(1);
    expect(second).toBe(SAMPLE_PAGE);
  });

  it('caches getLayout the same way', async () => {
    const adapter = buildAdapter();
    const service = new DelegatingCmsServiceSSR(adapter);

    await service.getLayout('default', 'de', 'main');
    await service.getLayout('default', 'de', 'main');

    expect(adapter.getLayout).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache `{ notfound: true }` — a miss re-hits the adapter', async () => {
    const adapter = buildAdapter({ getPage: jest.fn(async () => ({ notfound: true as const })) });
    const service = new DelegatingCmsServiceSSR(adapter);

    await service.getPage('missing', 'de', 'main');
    await service.getPage('missing', 'de', 'main');

    expect(adapter.getPage).toHaveBeenCalledTimes(2);
  });
});

describe('DelegatingCmsServiceSSR — handleWebhook surface', () => {
  const signature = (rawBody: string) => `sig:${rawBody}`;

  const buildWebhookAdapter = (overrides: Partial<CmsAdapter> = {}): jest.Mocked<CmsAdapter> =>
    buildAdapter({
      id: 'storyblok',
      validateWebhookSignature: jest.fn((headers: Headers, rawBody: string) => {
        return headers.get('webhook-signature') === signature(rawBody);
      }),
      mapWebhookPayload: jest.fn(() => [{ kind: 'page', slug: 'home', locale: 'de', site: 'main' }]),
      ...overrides,
    });

  const makeRequest = (rawBody: string, signed = true): Request =>
    ({
      text: jest.fn(async () => rawBody),
      headers: new Headers(signed ? { 'webhook-signature': signature(rawBody) } : {}),
    }) as unknown as Request;

  it('is undefined when the adapter exposes no webhook surface', () => {
    const service = new DelegatingCmsServiceSSR(buildAdapter());
    expect(service.handleWebhook).toBeUndefined();
  });

  it('is a function when the adapter provides validate + map primitives', () => {
    const service = new DelegatingCmsServiceSSR(buildWebhookAdapter());
    expect(typeof service.handleWebhook).toBe('function');
  });

  it('prefers the adapter `handleWebhook` when it owns the whole request', async () => {
    const handleWebhook = jest.fn(async () => ({ status: 202, body: { custom: true } }));
    const adapter = buildWebhookAdapter({ handleWebhook });
    const service = new DelegatingCmsServiceSSR(adapter);

    const result = await service.handleWebhook!(makeRequest('{}'));

    expect(handleWebhook).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 202, body: { custom: true } });
  });

  it('returns 401 for an invalid signature and does not map the payload', async () => {
    const adapter = buildWebhookAdapter();
    const service = new DelegatingCmsServiceSSR(adapter);

    const result = await service.handleWebhook!(makeRequest('{"action":"published"}', false));

    expect(result.status).toBe(401);
    expect(adapter.mapWebhookPayload).not.toHaveBeenCalled();
  });

  it('returns 200 + invalidation count for a valid signature', async () => {
    const adapter = buildWebhookAdapter();
    const service = new DelegatingCmsServiceSSR(adapter);

    const result = await service.handleWebhook!(makeRequest('{"action":"published","full_slug":"home"}'));

    expect(result).toEqual({ status: 200, body: { invalidated: 1 } });
  });

  it('invalidates the cached page so the next getPage re-hits the adapter (cache round-trip)', async () => {
    const adapter = buildWebhookAdapter();
    const service = new DelegatingCmsServiceSSR(adapter);

    // Warm the cache: two reads → adapter hit once.
    await service.getPage('home', 'de', 'main');
    await service.getPage('home', 'de', 'main');
    expect(adapter.getPage).toHaveBeenCalledTimes(1);

    // Webhook invalidates (slug 'home', locale 'de', site 'main').
    await service.handleWebhook!(makeRequest('{"action":"published","full_slug":"home"}'));

    // Next read misses → adapter hit again.
    await service.getPage('home', 'de', 'main');
    expect(adapter.getPage).toHaveBeenCalledTimes(2);
  });

  it('returns 400 for a body that is not valid JSON', async () => {
    const adapter = buildWebhookAdapter();
    const service = new DelegatingCmsServiceSSR(adapter);

    const result = await service.handleWebhook!(makeRequest('not-json'));

    expect(result.status).toBe(400);
  });
});
