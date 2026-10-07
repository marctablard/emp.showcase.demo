/**
 * Acceptance tests for `StoryblokCmsAdapter`.
 *
 * The adapter wires `StoryblokCmsApi` (SDK encapsulation) and
 * `StoryblokCmsMapper` (TipTap → AST + story → CMSPage) into the
 * `CmsAdapter` SPI consumed by `DelegatingCmsServiceSSR`. It is the
 * only file outside `src/platform/integrations/storyblok/` that knows
 * Storyblok is in play.
 *
 * Behaviour pinned:
 *  - `id === 'storyblok'`, registered under `CmsAdapter:storyblok`.
 *  - `hasContent()` reflects the access-token presence — agrees with the
 *    API's lazy-init guard (the app boots without a token).
 *  - `getPage` delegates to the API, then the mapper, never throws.
 *    `null` from the API → `{ notfound: true }`. API error →
 *    warn-log + `{ notfound: true }`.
 *  - `getNavigation` is a stub `{ notfound: true }` (parity with the
 *    other adapters).
 *  - `getEditableProps` is a pure `data-blok-*` object, NOT a React
 *    element; a component without an `_editable` payload → `{}`.
 *  - `BridgeScript` is the `StoryblokBridgeScript` component type
 *    (mounted once in the layout for the Visual Editor).
 */
import nodeCrypto from 'node:crypto';
import { getInjectableId } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSPage } from '@/platform/services/model/cms';
import type { StoryblokCmsApi, StoryblokStoryResult } from '../StoryblokCmsApi';
import { StoryblokCmsAdapter } from './StoryblokCmsAdapter';
import type { StoryblokCmsMapper } from './StoryblokCmsMapper';

const silentLogger = (): jest.Mocked<LoggerService> =>
  ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

const buildApi = (overrides: Partial<StoryblokCmsApi> = {}): jest.Mocked<StoryblokCmsApi> =>
  ({
    getStory: jest.fn(async () => null),
    hasToken: jest.fn(() => false),
    ...overrides,
  }) as unknown as jest.Mocked<StoryblokCmsApi>;

const SAMPLE_PAGE: CMSPage = {
  title: 'Home',
  description: 'A page',
  url: 'home',
  components: [],
};

const buildMapper = (
  overrides: Partial<StoryblokCmsMapper> = {},
): { mapper: jest.Mocked<StoryblokCmsMapper>; mapPage: jest.Mock } => {
  const mapPage = jest.fn(() => SAMPLE_PAGE);
  const mapper = {
    mapPage,
    mapRichtext: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<StoryblokCmsMapper>;
  return { mapper, mapPage };
};

const storyResult = (content?: Record<string, unknown>): StoryblokStoryResult =>
  ({
    data: {
      story: {
        id: 1,
        full_slug: 'main/about',
        slug: 'about',
        name: 'About',
        content: content ?? { body: [] },
      },
    },
  }) as unknown as StoryblokStoryResult;

const originalToken = process.env.NEXT_STORYBLOK_ACCESS_TOKEN;

afterAll(() => {
  if (originalToken === undefined) {
    delete process.env.NEXT_STORYBLOK_ACCESS_TOKEN;
  } else {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = originalToken;
  }
});

describe('StoryblokCmsAdapter — identity', () => {
  it('reports id === "storyblok"', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    expect(adapter.id).toBe('storyblok');
  });

  it('is `@injectable("CmsAdapter:storyblok")`', () => {
    expect(getInjectableId(StoryblokCmsAdapter)).toBe('CmsAdapter:storyblok');
  });

  it('does NOT call the Content-Delivery SDK directly (source-text audit) — only the API encapsulation', () => {
    // The adapter owns its render path; Content-Delivery lives ONLY in the
    // `StoryblokCmsApi` capsule. The adapter must NOT name `storyblokInit`,
    // `apiPlugin`, `StoryblokClient`, or `getStoryblokApi`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const path = require('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, './StoryblokCmsAdapter.ts'), 'utf8') as string;

    expect(source).not.toMatch(/\bstoryblokInit\b/);
    expect(source).not.toMatch(/\bapiPlugin\b/);
    expect(source).not.toMatch(/\bStoryblokClient\b/);
    expect(source).not.toMatch(/\bgetStoryblokApi\b/);
  });
});

describe('StoryblokCmsAdapter — hasContent()', () => {
  it('returns true when the API reports a configured token', () => {
    const api = buildApi({ hasToken: jest.fn(() => true) });
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    expect(adapter.hasContent()).toBe(true);
  });

  it('returns false when the API reports no token (matches the no-token fallback path)', () => {
    const api = buildApi({ hasToken: jest.fn(() => false) });
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    expect(adapter.hasContent()).toBe(false);
  });

  it('never throws', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    expect(() => adapter.hasContent()).not.toThrow();
  });
});

describe('StoryblokCmsAdapter — getPage(slug, locale, site)', () => {
  it('delegates the slug/locale/site to the API and returns the mapped CMSPage', async () => {
    const story = storyResult();
    const api = buildApi({ getStory: jest.fn(async () => story) });
    const { mapper, mapPage } = buildMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    const result = await adapter.getPage('about', 'en', 'main');

    expect(api.getStory).toHaveBeenCalledWith('about', 'en', 'main');
    expect(mapPage).toHaveBeenCalledWith(story.data.story);
    expect(result).toBe(SAMPLE_PAGE);
  });

  it('returns { notfound: true } when the API returns null (no story for slug)', async () => {
    const api = buildApi({ getStory: jest.fn(async () => null) });
    const { mapper, mapPage } = buildMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    const result = await adapter.getPage('missing', 'en', 'main');

    expect('notfound' in result && result.notfound).toBe(true);
    expect(mapPage).not.toHaveBeenCalled();
  });

  it('returns { notfound: true } when the API throws (errors are caught, no rethrow)', async () => {
    const api = buildApi({
      getStory: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    await expect(adapter.getPage('boom', 'en', 'main')).resolves.toEqual(expect.objectContaining({ notfound: true }));
  });

  it('returns { notfound: true } when the mapper throws (mapper crash is contained)', async () => {
    const api = buildApi({ getStory: jest.fn(async () => storyResult()) });
    const { mapper } = buildMapper({
      mapPage: jest.fn(() => {
        throw new Error('mapper boom');
      }) as unknown as StoryblokCmsMapper['mapPage'],
    });
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    await expect(adapter.getPage('about', 'en', 'main')).resolves.toEqual(expect.objectContaining({ notfound: true }));
  });

  it('logs a warn-level message when the API errors (LoggerService injected)', async () => {
    const api = buildApi({
      getStory: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    const { mapper } = buildMapper();
    const logger = silentLogger();
    const adapter = new StoryblokCmsAdapter(api, mapper, logger);

    await adapter.getPage('boom', 'en', 'main');

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('passes the site through to the API verbatim (multi-site prefixing lives in the API)', async () => {
    const api = buildApi({ getStory: jest.fn(async () => null) });
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    await adapter.getPage('home', 'de', 'us-branch');

    expect(api.getStory).toHaveBeenCalledWith('home', 'de', 'us-branch');
  });
});

describe('StoryblokCmsAdapter — getNavigation(locale, site)', () => {
  it('returns { notfound: true } as the current stub (parity with the other adapters)', async () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    await expect(adapter.getNavigation('en', 'main')).resolves.toEqual({ notfound: true });
  });

  it('never throws (Adapter SPI invariant)', async () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    await expect(adapter.getNavigation('en', 'main')).resolves.toBeDefined();
  });
});

describe('StoryblokCmsAdapter — getEditableProps(component)', () => {
  it('emits the SDK-shaped `data-blok-*` the Visual-Editor bridge binds against (NOT component-name / bare-uid)', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    // The bridge binds against the full stringified `_editable` object on
    // `data-blok-c` and `${storyId}-${blockUid}` on `data-blok-uid`.
    const editable = { name: 'button', space: '12345', uid: 'block-uid', id: 'story-id' };
    const props = adapter.getEditableProps?.({
      id: 'b1',
      type: 'button',
      _editable: `<!--#storyblok#${JSON.stringify(editable)}-->`,
    } as never);

    expect(props).toEqual({
      'data-blok-c': JSON.stringify(editable),
      'data-blok-uid': 'story-id-block-uid',
    });
    // Regression pin: the old impl set `data-blok-c` to the component name.
    expect(props?.['data-blok-c' as keyof typeof props]).not.toBe('button');
  });

  it('returns a plain DOM-attribute object (not a React element)', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    const props = adapter.getEditableProps?.({
      id: 'b1',
      type: 'button',
      _editable: '<!--#storyblok#{"name":"button","space":"1","uid":"u","id":"i"}-->',
    } as never);

    expect(typeof props).toBe('object');
    expect(props).not.toBeNull();
  });

  it('returns an empty object for a component without an `_editable` payload', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    const props = adapter.getEditableProps?.({ id: 'b1', type: 'button' } as never);

    expect(props).toEqual({});
  });

  it('returns an empty object for a malformed `_editable` payload (helper swallows the parse error)', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    const props = adapter.getEditableProps?.({
      id: 'b1',
      type: 'button',
      _editable: '<!--#storyblok#{not-json}-->',
    } as never);

    expect(props).toEqual({});
  });
});

describe('StoryblokCmsAdapter — BridgeScript', () => {
  it('exposes a renderable `BridgeScript` component type (mounted once in the layout)', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    expect(typeof adapter.BridgeScript).toBe('function');
  });
});

describe('StoryblokCmsAdapter — getLayout(layoutId, locale, site)', () => {
  const SAMPLE_LAYOUT = {
    id: 'layout-uuid',
    type: 'layout' as const,
    body: [{ id: 'slot-1', type: 'content-slot' as const }],
  };

  const buildLayoutMapper = () => {
    const mapLayout = jest.fn(() => SAMPLE_LAYOUT);
    const mapper = {
      mapPage: jest.fn(() => SAMPLE_PAGE),
      mapLayout,
      mapRichtext: jest.fn(),
    } as unknown as jest.Mocked<StoryblokCmsMapper>;
    return { mapper, mapLayout };
  };

  it('fetches `layouts/<id>` at the published version and maps the story via mapLayout', async () => {
    const api = buildApi({ getStory: jest.fn(async () => storyResult({ body: [] })) });
    const { mapper, mapLayout } = buildLayoutMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    const result = await adapter.getLayout('default', 'en', 'main');

    expect(api.getStory).toHaveBeenCalledWith('layouts/default', 'en', 'main', 'published');
    expect(mapLayout).toHaveBeenCalledTimes(1);
    expect(result).toEqual(SAMPLE_LAYOUT);
  });

  it('returns `{ notfound: true }` when the API yields no story', async () => {
    const api = buildApi({ getStory: jest.fn(async () => null) });
    const { mapper, mapLayout } = buildLayoutMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    const result = await adapter.getLayout('default', 'en', 'main');

    expect(result).toEqual(expect.objectContaining({ notfound: true }));
    expect(mapLayout).not.toHaveBeenCalled();
  });

  it('never throws — an API error surfaces as `{ notfound: true }` (warn-logged)', async () => {
    const logger = silentLogger();
    const api = buildApi({
      getStory: jest.fn(async () => {
        throw new Error('network down');
      }),
    });
    const { mapper } = buildLayoutMapper();
    const adapter = new StoryblokCmsAdapter(api, mapper, logger);

    const result = await adapter.getLayout('default', 'en', 'main');

    expect(result).toEqual(expect.objectContaining({ notfound: true }));
    expect(logger.warn).toHaveBeenCalled();
  });

  it('accepts a valid layout with exactly one content-slot', async () => {
    const validLayout = {
      id: 'layout-uuid',
      type: 'layout' as const,
      body: [{ id: 'slot-1', type: 'content-slot' as const }],
    };
    const api = buildApi({ getStory: jest.fn(async () => storyResult({ body: [] })) });
    const mapLayout = jest.fn(() => validLayout);
    const mapper = {
      mapPage: jest.fn(() => SAMPLE_PAGE),
      mapLayout,
      mapRichtext: jest.fn(),
    } as unknown as jest.Mocked<import('./StoryblokCmsMapper').StoryblokCmsMapper>;
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    const result = await adapter.getLayout('default', 'en', 'main');

    expect(result).toEqual(validLayout);
  });

  it('returns { notfound: true } when mapped layout fails LayoutContentSchema (e.g. two content-slots)', async () => {
    const invalidLayout = {
      id: 'layout-uuid',
      type: 'layout' as const,
      body: [
        { id: 'slot-1', type: 'content-slot' as const },
        { id: 'slot-2', type: 'content-slot' as const },
      ],
    };
    const api = buildApi({ getStory: jest.fn(async () => storyResult({ body: [] })) });
    const mapLayout = jest.fn(() => invalidLayout);
    const mapper = {
      mapPage: jest.fn(() => SAMPLE_PAGE),
      mapLayout,
      mapRichtext: jest.fn(),
    } as unknown as jest.Mocked<import('./StoryblokCmsMapper').StoryblokCmsMapper>;
    const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());

    const result = await adapter.getLayout('default', 'en', 'main');

    expect(result).toEqual(expect.objectContaining({ notfound: true }));
  });

  it('logs a warn when layout validation fails', async () => {
    const invalidLayout = {
      id: 'layout-uuid',
      type: 'layout' as const,
      body: [] as { id: string; type: 'content-slot' }[],
    };
    const api = buildApi({ getStory: jest.fn(async () => storyResult({ body: [] })) });
    const mapLayout = jest.fn(() => invalidLayout);
    const logger = silentLogger();
    const mapper = {
      mapPage: jest.fn(() => SAMPLE_PAGE),
      mapLayout,
      mapRichtext: jest.fn(),
    } as unknown as jest.Mocked<import('./StoryblokCmsMapper').StoryblokCmsMapper>;
    const adapter = new StoryblokCmsAdapter(api, mapper, logger);

    await adapter.getLayout('default', 'en', 'main');

    expect(logger.warn).toHaveBeenCalled();
  });
});

// Generated per run rather than checked in as a literal: the value only has to
// be identical on both sides of the HMAC round-trip within this suite.
const WEBHOOK_SECRET = nodeCrypto.randomBytes(16).toString('hex');

const sign = (rawBody: string, secret: string = WEBHOOK_SECRET): string =>
  nodeCrypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

const buildAdapter = () => {
  const { mapper } = buildMapper();
  return new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());
};

describe('StoryblokCmsAdapter — validateWebhookSignature (HMAC-SHA-256, constant-time)', () => {
  const originalSecret = process.env.NEXT_CMS_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.NEXT_CMS_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.NEXT_CMS_WEBHOOK_SECRET;
    } else {
      process.env.NEXT_CMS_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('accepts a body signed with the configured secret', () => {
    const body = JSON.stringify({ action: 'published', full_slug: 'home' });
    const headers = new Headers({ 'webhook-signature': sign(body) });

    expect(buildAdapter().validateWebhookSignature(headers, body)).toBe(true);
  });

  it('rejects a same-length but wrong signature', () => {
    const body = JSON.stringify({ action: 'published', full_slug: 'home' });
    const wrong = sign(body, 'other-secret'); // also 64 hex chars
    const headers = new Headers({ 'webhook-signature': wrong });

    expect(buildAdapter().validateWebhookSignature(headers, body)).toBe(false);
  });

  it('returns false (does NOT throw) on a wrong-length signature — length guard', () => {
    const body = JSON.stringify({ action: 'published', full_slug: 'home' });
    const headers = new Headers({ 'webhook-signature': 'deadbeef' }); // 8 chars, not 64

    const adapter = buildAdapter();
    expect(() => adapter.validateWebhookSignature(headers, body)).not.toThrow();
    expect(adapter.validateWebhookSignature(headers, body)).toBe(false);
  });

  it('rejects when the signature header is absent', () => {
    const body = JSON.stringify({ action: 'published', full_slug: 'home' });

    expect(buildAdapter().validateWebhookSignature(new Headers(), body)).toBe(false);
  });

  it('rejects (never validates) when no secret is configured', () => {
    delete process.env.NEXT_CMS_WEBHOOK_SECRET;
    const body = JSON.stringify({ action: 'published', full_slug: 'home' });
    const headers = new Headers({ 'webhook-signature': sign(body) });

    expect(buildAdapter().validateWebhookSignature(headers, body)).toBe(false);
  });

  it('does NOT use a naive === string comparison (source-text audit)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
    const path = require('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, './StoryblokCmsAdapter.ts'), 'utf8') as string;

    expect(source).toMatch(/timingSafeEqual/);
  });
});

describe('StoryblokCmsAdapter — mapWebhookPayload', () => {
  const originalMultiSite = process.env.NEXT_STORYBLOK_MULTI_SITE;
  const originalLegacyMultiSite = process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE;
  const originalSites = process.env.NEXT_PUBLIC_AVAILABLE_SITES;

  beforeEach(() => {
    delete process.env.NEXT_STORYBLOK_MULTI_SITE;
    delete process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE;
    // Single-site spaces fan out across the configured sites — pin a known set.
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';
  });

  afterAll(() => {
    if (originalMultiSite === undefined) {
      delete process.env.NEXT_STORYBLOK_MULTI_SITE;
    } else {
      process.env.NEXT_STORYBLOK_MULTI_SITE = originalMultiSite;
    }
    if (originalLegacyMultiSite === undefined) {
      delete process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE;
    } else {
      process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE = originalLegacyMultiSite;
    }
    if (originalSites === undefined) {
      delete process.env.NEXT_PUBLIC_AVAILABLE_SITES;
    } else {
      process.env.NEXT_PUBLIC_AVAILABLE_SITES = originalSites;
    }
  });

  it('fans a slug without a locale prefix out across every configured locale (real site key)', () => {
    const events = buildAdapter().mapWebhookPayload(new Headers(), { action: 'published', full_slug: 'about' });

    expect(events).toEqual([
      { kind: 'page', slug: 'about', locale: 'en', site: 'main' },
      { kind: 'page', slug: 'about', locale: 'de', site: 'main' },
    ]);
  });

  it('fans out across all configured sites when the slug carries no explicit site prefix', () => {
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main,us-branch';

    const events = buildAdapter().mapWebhookPayload(new Headers(), { action: 'published', full_slug: 'de/about' });

    // single locale (prefixed) × two sites — invalidation keys stay congruent
    // with whatever route segment cached the read.
    expect(events).toEqual([
      { kind: 'page', slug: 'about', locale: 'de', site: 'main' },
      { kind: 'page', slug: 'about', locale: 'de', site: 'us-branch' },
    ]);
  });

  it('falls back to the default site when no available sites are configured', () => {
    const savedDefaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE;
    delete process.env.NEXT_PUBLIC_AVAILABLE_SITES;
    process.env.NEXT_PUBLIC_DEFAULT_SITE = 'fallback-site';
    try {
      const events = buildAdapter().mapWebhookPayload(new Headers(), { action: 'published', full_slug: 'de/about' });

      expect(events).toEqual([{ kind: 'page', slug: 'about', locale: 'de', site: 'fallback-site' }]);
    } finally {
      if (savedDefaultSite === undefined) {
        delete process.env.NEXT_PUBLIC_DEFAULT_SITE;
      } else {
        process.env.NEXT_PUBLIC_DEFAULT_SITE = savedDefaultSite;
      }
    }
  });

  it('targets a single locale when the slug carries a locale prefix', () => {
    const events = buildAdapter().mapWebhookPayload(new Headers(), { action: 'published', full_slug: 'de/about' });

    expect(events).toEqual([{ kind: 'page', slug: 'about', locale: 'de', site: 'main' }]);
  });

  it('maps a layouts/ slug to layout events', () => {
    const events = buildAdapter().mapWebhookPayload(new Headers(), {
      action: 'published',
      full_slug: 'de/layouts/default',
    });

    expect(events).toEqual([{ kind: 'layout', layoutId: 'default', locale: 'de', site: 'main' }]);
  });

  it('extracts the site prefix in a multi-site space (single addressed site)', () => {
    process.env.NEXT_STORYBLOK_MULTI_SITE = 'true';

    const events = buildAdapter().mapWebhookPayload(new Headers(), {
      action: 'published',
      full_slug: 'us-branch/de/about',
    });

    expect(events).toEqual([{ kind: 'page', slug: 'about', locale: 'de', site: 'us-branch' }]);
  });

  it('handles unpublished and deleted actions', () => {
    const adapter = buildAdapter();
    expect(adapter.mapWebhookPayload(new Headers(), { action: 'unpublished', full_slug: 'de/x' })).toHaveLength(1);
    expect(adapter.mapWebhookPayload(new Headers(), { action: 'deleted', full_slug: 'de/x' })).toHaveLength(1);
  });

  it('returns null for an unknown action, a missing full_slug, or a non-object body', () => {
    const adapter = buildAdapter();
    expect(adapter.mapWebhookPayload(new Headers(), { action: 'unknown', full_slug: 'x' })).toBeNull();
    expect(adapter.mapWebhookPayload(new Headers(), { action: 'published' })).toBeNull();
    expect(adapter.mapWebhookPayload(new Headers(), null)).toBeNull();
    expect(adapter.mapWebhookPayload(new Headers(), 'nope')).toBeNull();
  });
});
