/**
 * Behaviour matrix for `FallbackCmsAdapter` — the composite `CmsAdapter`
 * that wires a primary provider to a default-content fallback source
 * (EMP-16 Phase G).
 *
 * Contract pinned here (all assertions are RED until the subject exists):
 * - Required accessors (`getPage`/`getLayout`/`getNavigation`) ask the
 *   primary first. A primary `{ notfound: true }` result delegates to the
 *   fallback source; ANY other result (a real page/layout/nav) is passed
 *   through verbatim and the fallback is never consulted.
 * - When delegating, the fallback is always queried with the fixed
 *   `fallbackSite` ('_default_'), NEVER the caller's original `site`. The
 *   slug/layoutId/locale are forwarded unchanged.
 * - When BOTH primary and fallback miss, the composite surfaces a
 *   `{ notfound: true }` result.
 * - `hasContent()` is the OR of primary and fallback presence.
 * - The optional surface (`getEditableProps` / `BridgeScript` / webhook
 *   primitives) is presence-mirrored from the PRIMARY only: it is wired iff
 *   the primary has it, delegates exclusively to the primary, and the
 *   fallback's optional surface is NEVER invoked. When the primary omits an
 *   optional member, the composite member is `undefined`.
 * - `id === 'fallback'`.
 *
 * The adapters are plain `jest.fn` stubs — we are pinning the composite's
 * delegation wiring, not exercising any real provider.
 *
 * Tier: Platform tests (Jest `Platform Tests` project, node env).
 */
import type { ComponentType, HTMLAttributes } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type {
  CMSComponent,
  CMSLayout,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
  WebhookEvent,
  WebhookResult,
} from '../../model/cms';
import type { CmsAdapter } from '../CmsAdapter';
import { FallbackCmsAdapter } from './FallbackCmsAdapter';

const FALLBACK_SITE = '_default_';

const PRIMARY_PAGE: CMSPage = { title: 'Primary', description: 'p', url: '/p', components: [] };
const FALLBACK_PAGE: CMSPage = { title: 'Fallback', description: 'f', url: '/f', components: [] };
const PRIMARY_LAYOUT: CMSLayout = { id: 'l-primary', type: 'layout', body: [] };
const FALLBACK_LAYOUT: CMSLayout = { id: 'l-fallback', type: 'layout', body: [] };
const PRIMARY_NAV: CMSNavigation = { items: [{ title: 'Primary', href: '/p' }] };
const FALLBACK_NAV: CMSNavigation = { items: [{ title: 'Fallback', href: '/f' }] };
const NOT_FOUND: CMSNoResult = { notfound: true };

const SAMPLE_COMPONENT: CMSComponent = { id: 'c1', type: 'button', title: 'Buy', link: '/' };

function buildAdapter(overrides: Partial<CmsAdapter> = {}): jest.Mocked<CmsAdapter> {
  const base: CmsAdapter = {
    id: 'stub',
    hasContent: jest.fn(() => true),
    getPage: jest.fn(async () => NOT_FOUND),
    getLayout: jest.fn(async () => NOT_FOUND),
    getNavigation: jest.fn(async () => NOT_FOUND),
    ...overrides,
  };
  return base as jest.Mocked<CmsAdapter>;
}

const silentLogger = (): jest.Mocked<LoggerService> =>
  ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

function buildComposite(primary: jest.Mocked<CmsAdapter>, fallback: jest.Mocked<CmsAdapter>): FallbackCmsAdapter {
  return new FallbackCmsAdapter(primary, fallback, FALLBACK_SITE, silentLogger());
}

describe('FallbackCmsAdapter', () => {
  describe('id', () => {
    it('advertises the fixed composite id "fallback"', () => {
      const composite = buildComposite(buildAdapter(), buildAdapter());

      expect(composite.id).toBe('fallback');
    });
  });

  describe('getPage', () => {
    it('passes a primary hit through and never consults the fallback', async () => {
      const primary = buildAdapter({ getPage: jest.fn(async () => PRIMARY_PAGE) });
      const fallback = buildAdapter({ getPage: jest.fn(async () => FALLBACK_PAGE) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getPage('home', 'de', 'main');

      expect(result).toBe(PRIMARY_PAGE);
      expect(primary.getPage).toHaveBeenCalledWith('home', 'de', 'main');
      expect(fallback.getPage).not.toHaveBeenCalled();
    });

    it('delegates to the fallback on a primary miss, querying it with the fixed fallbackSite', async () => {
      const primary = buildAdapter({ getPage: jest.fn(async () => NOT_FOUND) });
      const fallback = buildAdapter({ getPage: jest.fn(async () => FALLBACK_PAGE) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getPage('home', 'de', 'main');

      expect(result).toBe(FALLBACK_PAGE);
      // Slug + locale forwarded unchanged; site forced to fallbackSite (NOT 'main').
      expect(fallback.getPage).toHaveBeenCalledWith('home', 'de', FALLBACK_SITE);
    });

    it('surfaces { notfound: true } when both primary and fallback miss', async () => {
      const primary = buildAdapter({ getPage: jest.fn(async () => NOT_FOUND) });
      const fallback = buildAdapter({ getPage: jest.fn(async () => NOT_FOUND) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getPage('home', 'de', 'main');

      expect(result).toEqual(NOT_FOUND);
    });
  });

  describe('getLayout', () => {
    it('passes a primary hit through and never consults the fallback', async () => {
      const primary = buildAdapter({ getLayout: jest.fn(async () => PRIMARY_LAYOUT) });
      const fallback = buildAdapter({ getLayout: jest.fn(async () => FALLBACK_LAYOUT) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getLayout('default', 'de', 'main');

      expect(result).toBe(PRIMARY_LAYOUT);
      expect(primary.getLayout).toHaveBeenCalledWith('default', 'de', 'main');
      expect(fallback.getLayout).not.toHaveBeenCalled();
    });

    it('delegates to the fallback on a primary miss, querying it with the fixed fallbackSite', async () => {
      const primary = buildAdapter({ getLayout: jest.fn(async () => NOT_FOUND) });
      const fallback = buildAdapter({ getLayout: jest.fn(async () => FALLBACK_LAYOUT) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getLayout('default', 'de', 'main');

      expect(result).toBe(FALLBACK_LAYOUT);
      expect(fallback.getLayout).toHaveBeenCalledWith('default', 'de', FALLBACK_SITE);
    });

    it('surfaces { notfound: true } when both primary and fallback miss', async () => {
      const primary = buildAdapter({ getLayout: jest.fn(async () => NOT_FOUND) });
      const fallback = buildAdapter({ getLayout: jest.fn(async () => NOT_FOUND) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getLayout('default', 'de', 'main');

      expect(result).toEqual(NOT_FOUND);
    });
  });

  describe('getNavigation', () => {
    it('passes a primary hit through and never consults the fallback', async () => {
      const primary = buildAdapter({ getNavigation: jest.fn(async () => PRIMARY_NAV) });
      const fallback = buildAdapter({ getNavigation: jest.fn(async () => FALLBACK_NAV) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getNavigation('de', 'main');

      expect(result).toBe(PRIMARY_NAV);
      expect(primary.getNavigation).toHaveBeenCalledWith('de', 'main');
      expect(fallback.getNavigation).not.toHaveBeenCalled();
    });

    it('delegates to the fallback on a primary miss, querying it with the fixed fallbackSite', async () => {
      const primary = buildAdapter({ getNavigation: jest.fn(async () => NOT_FOUND) });
      const fallback = buildAdapter({ getNavigation: jest.fn(async () => FALLBACK_NAV) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getNavigation('de', 'main');

      expect(result).toBe(FALLBACK_NAV);
      // locale forwarded unchanged; site forced to fallbackSite (NOT 'main').
      expect(fallback.getNavigation).toHaveBeenCalledWith('de', FALLBACK_SITE);
    });

    it('surfaces { notfound: true } when both primary and fallback miss', async () => {
      const primary = buildAdapter({ getNavigation: jest.fn(async () => NOT_FOUND) });
      const fallback = buildAdapter({ getNavigation: jest.fn(async () => NOT_FOUND) });
      const composite = buildComposite(primary, fallback);

      const result = await composite.getNavigation('de', 'main');

      expect(result).toEqual(NOT_FOUND);
    });
  });

  describe('hasContent()', () => {
    it('is true when only the fallback source has content (primary false OR fallback true)', () => {
      const primary = buildAdapter({ hasContent: jest.fn(() => false) });
      const fallback = buildAdapter({ hasContent: jest.fn(() => true) });
      const composite = buildComposite(primary, fallback);

      expect(composite.hasContent()).toBe(true);
    });

    it('is false only when neither primary nor fallback has content', () => {
      const primary = buildAdapter({ hasContent: jest.fn(() => false) });
      const fallback = buildAdapter({ hasContent: jest.fn(() => false) });
      const composite = buildComposite(primary, fallback);

      expect(composite.hasContent()).toBe(false);
    });
  });

  describe('optional surface — webhook (handleWebhook)', () => {
    it('mirrors the primary handleWebhook and delegates exclusively to the primary', async () => {
      const primaryResult: WebhookResult = { status: 202, body: { from: 'primary' } };
      const primaryHandle = jest.fn(async () => primaryResult);
      const fallbackHandle = jest.fn(async () => ({ status: 500 }) as WebhookResult);
      const primary = buildAdapter({ handleWebhook: primaryHandle });
      const fallback = buildAdapter({ handleWebhook: fallbackHandle });
      const composite = buildComposite(primary, fallback);
      const request = new Request('https://example.test/api/cms/webhook', { method: 'POST' });

      expect(typeof composite.handleWebhook).toBe('function');
      const result = await composite.handleWebhook!(request);

      expect(result).toBe(primaryResult);
      expect(primaryHandle).toHaveBeenCalledTimes(1);
      // The fallback's webhook surface is NEVER touched, even though it has one.
      expect(fallbackHandle).not.toHaveBeenCalled();
    });

    it('leaves handleWebhook undefined when the primary omits it (even if the fallback has it)', () => {
      const primary = buildAdapter(); // no handleWebhook
      const fallback = buildAdapter({ handleWebhook: jest.fn(async () => ({ status: 200 }) as WebhookResult) });
      const composite = buildComposite(primary, fallback);

      expect(composite.handleWebhook).toBeUndefined();
    });
  });

  describe('optional surface — webhook primitives (validateWebhookSignature + mapWebhookPayload)', () => {
    // These two are the production path for a Storyblok primary: it ships the
    // primitive pair (NOT handleWebhook), and DelegatingCmsServiceSSR only
    // orchestrates the verify -> map -> invalidate flow when BOTH are present.
    // If the composite drops either, the webhook route silently degrades to 405
    // and Phase-E cache invalidation breaks. Pin the mirroring + primary-only
    // delegation.
    it('mirrors the primary validateWebhookSignature and delegates exclusively to the primary', () => {
      const headers = new Headers({ 'webhook-signature': 'sig' });
      const rawBody = '{"action":"published"}';
      const primaryValidate = jest.fn(() => true);
      const fallbackValidate = jest.fn(() => false);
      const primary = buildAdapter({ validateWebhookSignature: primaryValidate });
      const fallback = buildAdapter({ validateWebhookSignature: fallbackValidate });
      const composite = buildComposite(primary, fallback);

      expect(typeof composite.validateWebhookSignature).toBe('function');
      const result = composite.validateWebhookSignature!(headers, rawBody);

      expect(result).toBe(true);
      expect(primaryValidate).toHaveBeenCalledWith(headers, rawBody);
      expect(fallbackValidate).not.toHaveBeenCalled();
    });

    it('leaves validateWebhookSignature undefined when the primary omits it (even if the fallback has it)', () => {
      const primary = buildAdapter(); // no validateWebhookSignature
      const fallback = buildAdapter({ validateWebhookSignature: jest.fn(() => true) });
      const composite = buildComposite(primary, fallback);

      expect(composite.validateWebhookSignature).toBeUndefined();
    });

    it('mirrors the primary mapWebhookPayload and delegates exclusively to the primary', () => {
      const headers = new Headers({ 'webhook-signature': 'sig' });
      const body = { action: 'published', story_id: 42 };
      const events: WebhookEvent[] = [{ kind: 'page', slug: 'home', locale: 'de', site: 'main' }];
      const primaryMap = jest.fn(() => events);
      const fallbackMap = jest.fn(() => null);
      const primary = buildAdapter({ mapWebhookPayload: primaryMap });
      const fallback = buildAdapter({ mapWebhookPayload: fallbackMap });
      const composite = buildComposite(primary, fallback);

      expect(typeof composite.mapWebhookPayload).toBe('function');
      const result = composite.mapWebhookPayload!(headers, body);

      expect(result).toBe(events);
      expect(primaryMap).toHaveBeenCalledWith(headers, body);
      expect(fallbackMap).not.toHaveBeenCalled();
    });

    it('leaves mapWebhookPayload undefined when the primary omits it', () => {
      const primary = buildAdapter(); // no mapWebhookPayload
      const fallback = buildAdapter({ mapWebhookPayload: jest.fn(() => null) });
      const composite = buildComposite(primary, fallback);

      expect(composite.mapWebhookPayload).toBeUndefined();
    });
  });

  describe('optional surface — getEditableProps', () => {
    it('mirrors the primary getEditableProps and delegates exclusively to the primary', () => {
      const props: HTMLAttributes<HTMLElement> = { id: 'editable-primary' };
      const primaryGet = jest.fn(() => props);
      const fallbackGet = jest.fn(() => ({ id: 'editable-fallback' }) as HTMLAttributes<HTMLElement>);
      const primary = buildAdapter({ getEditableProps: primaryGet });
      const fallback = buildAdapter({ getEditableProps: fallbackGet });
      const composite = buildComposite(primary, fallback);

      expect(typeof composite.getEditableProps).toBe('function');
      const result = composite.getEditableProps!(SAMPLE_COMPONENT);

      expect(result).toBe(props);
      expect(primaryGet).toHaveBeenCalledWith(SAMPLE_COMPONENT);
      expect(fallbackGet).not.toHaveBeenCalled();
    });

    it('leaves getEditableProps undefined when the primary omits it', () => {
      const primary = buildAdapter(); // no getEditableProps
      const fallback = buildAdapter({ getEditableProps: jest.fn(() => ({})) });
      const composite = buildComposite(primary, fallback);

      expect(composite.getEditableProps).toBeUndefined();
    });
  });

  describe('optional surface — BridgeScript', () => {
    it('mirrors the primary BridgeScript verbatim', () => {
      const PrimaryBridge: ComponentType = () => null;
      const FallbackBridge: ComponentType = () => null;
      const primary = buildAdapter({ BridgeScript: PrimaryBridge });
      const fallback = buildAdapter({ BridgeScript: FallbackBridge });
      const composite = buildComposite(primary, fallback);

      expect(composite.BridgeScript).toBe(PrimaryBridge);
    });

    it('leaves BridgeScript undefined when the primary omits it', () => {
      const PrimaryBridge = undefined;
      const FallbackBridge: ComponentType = () => null;
      const primary = buildAdapter({ BridgeScript: PrimaryBridge });
      const fallback = buildAdapter({ BridgeScript: FallbackBridge });
      const composite = buildComposite(primary, fallback);

      expect(composite.BridgeScript).toBeUndefined();
    });
  });
});
