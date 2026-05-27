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

const storyResult = (content: Record<string, unknown> = { body: [] }): StoryblokStoryResult =>
  ({
    data: {
      story: {
        id: 1,
        full_slug: 'main/about',
        slug: 'about',
        name: 'About',
        content,
      },
    },
  }) as unknown as StoryblokStoryResult;

const originalToken = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;

afterAll(() => {
  if (originalToken === undefined) {
    delete process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;
  } else {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = originalToken;
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
  it('returns a plain DOM-attribute object (not a React element) with `data-blok-*` for an editable component', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    const props = adapter.getEditableProps?.({
      id: 'b1',
      type: 'button',
      _editable: '<!--#storyblok#{"uid":"b1"}-->',
    } as never);

    expect(typeof props).toBe('object');
    expect(props).not.toBeNull();
    const keys = Object.keys(props ?? {});
    expect(keys.some((k) => k.startsWith('data-blok'))).toBe(true);
  });

  it('returns an empty object for a component without an `_editable` payload', () => {
    const { mapper } = buildMapper();
    const adapter = new StoryblokCmsAdapter(buildApi(), mapper, silentLogger());

    const props = adapter.getEditableProps?.({ id: 'b1', type: 'button' } as never);

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
