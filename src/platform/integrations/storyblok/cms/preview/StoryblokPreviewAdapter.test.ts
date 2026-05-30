/**
 * Acceptance tests for `StoryblokPreviewAdapter` (EMP-15 §4).
 *
 * The Node-only preview adapter extends the pure detector (id +
 * `isPreviewRequest` delegate to `storyblok-preview-detection`) and adds
 * `renderPreviewPage(...)`. Validation ORDER, returning `null` on any failure
 * (the route then calls `notFound()`):
 *   (1) re-run `isStoryblokPreviewRequest(url)` — presence + timestamp.
 *   (2) Space-ID match: `_storyblok_tk[space_id]` === `api.getSpaceId()`.
 *       If `api.getSpaceId()` is `null` (space id unconfigured): warn-log and
 *       SKIP step 2 (documented residual risk, FU-004) — do NOT reject.
 *   (3) Fetch the DRAFT story: `api.getStory(slug, locale, site, 'draft')`;
 *       `null` → `null`.
 *   On success: map via `mapper.mapPage(...)`, render the page body MOUNTING
 *   the bridge script, and return a `ReactElement`.
 *
 * The HMAC token CONTENT is intentionally NOT validated (board-accepted,
 * EMP-11 §8 FU-004).
 *
 * `StoryblokBridgeScript` is mocked so this Node-environment test never pulls
 * the real `@storyblok/*` SDK in. Clock pinned via fake timers because the
 * timestamp check reads the runtime clock.
 */
import { isValidElement } from 'react';
import { getInjectableId } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSPage } from '@/platform/services/model/cms';
import type { StoryblokCmsApi, StoryblokStoryResult } from '../StoryblokCmsApi';
import type { StoryblokCmsMapper } from '../impl/StoryblokCmsMapper';
import { StoryblokPreviewAdapter } from './StoryblokPreviewAdapter';

// Keep the real `@storyblok/*` SDK out of this Node test — the bridge script
// is a client component that imports the SDK at module load.
jest.mock('../impl/StoryblokBridgeScript', () => ({
  __esModule: true,
  StoryblokBridgeScript: () => null,
  default: () => null,
}));

/** Fixed reference instant: 2026-05-30T12:00:00Z. */
const NOW_MS = Date.UTC(2026, 4, 30, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

const SPACE_ID = '295018';

const silentLogger = (): jest.Mocked<LoggerService> =>
  ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

const SAMPLE_PAGE: CMSPage = {
  title: 'Home (draft)',
  description: 'A draft page',
  url: 'home',
  components: [],
};

const storyResult = (content: Record<string, unknown> = { body: [] }): StoryblokStoryResult =>
  ({
    data: {
      story: { id: 1, full_slug: 'main/home', slug: 'home', name: 'Home', content },
    },
  }) as unknown as StoryblokStoryResult;

const buildApi = (overrides: Partial<StoryblokCmsApi> = {}): jest.Mocked<StoryblokCmsApi> =>
  ({
    getStory: jest.fn(async () => storyResult()),
    hasToken: jest.fn(() => true),
    getSpaceId: jest.fn(() => SPACE_ID),
    ...overrides,
  }) as unknown as jest.Mocked<StoryblokCmsApi>;

const buildMapper = (): jest.Mocked<StoryblokCmsMapper> =>
  ({
    mapPage: jest.fn(() => SAMPLE_PAGE),
    mapRichtext: jest.fn(),
  }) as unknown as jest.Mocked<StoryblokCmsMapper>;

/**
 * Build a preview URL. `ts` defaults to a fresh timestamp; `spaceId` defaults
 * to the matching space id. Pass `null` to OMIT a key.
 */
function previewUrl(opts: { ts?: number | null; spaceId?: string | null; omitToken?: boolean } = {}): URL {
  const { ts = NOW_SECONDS, spaceId = SPACE_ID, omitToken = false } = opts;
  const url = new URL('http://preview.local/preview/main/en/home');
  url.searchParams.set('_storyblok', '1');
  if (ts !== null) url.searchParams.set('_storyblok_tk[timestamp]', String(ts));
  if (!omitToken) url.searchParams.set('_storyblok_tk[token]', 'deadbeefcafef00d');
  if (spaceId !== null) url.searchParams.set('_storyblok_tk[space_id]', spaceId);
  return url;
}

const RENDER_PARAMS = { slug: 'home', locale: 'en', site: 'main' };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW_MS);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StoryblokPreviewAdapter — identity & detector delegation', () => {
  it('reports id === "storyblok"', () => {
    const adapter = new StoryblokPreviewAdapter(buildApi(), buildMapper(), silentLogger());

    expect(adapter.id).toBe('storyblok');
  });

  it('is `@injectable("CmsPreviewAdapter:storyblok")`', () => {
    expect(getInjectableId(StoryblokPreviewAdapter)).toBe('CmsPreviewAdapter:storyblok');
  });

  it('isPreviewRequest delegates to the pure detector (fresh, well-formed URL → true)', () => {
    const adapter = new StoryblokPreviewAdapter(buildApi(), buildMapper(), silentLogger());

    expect(adapter.isPreviewRequest(previewUrl())).toBe(true);
  });

  it('isPreviewRequest returns false for a plain (non-preview) URL', () => {
    const adapter = new StoryblokPreviewAdapter(buildApi(), buildMapper(), silentLogger());

    expect(adapter.isPreviewRequest(new URL('http://preview.local/preview/main/en/home'))).toBe(false);
  });
});

describe('StoryblokPreviewAdapter — renderPreviewPage success path', () => {
  it('renders a ReactElement for a valid preview (fresh ts, matching space id)', async () => {
    const api = buildApi();
    const mapper = buildMapper();
    const adapter = new StoryblokPreviewAdapter(api, mapper, silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl() });

    expect(el).not.toBeNull();
    expect(isValidElement(el)).toBe(true);
  });

  it('fetches the DRAFT version of the story for the given slug/locale/site', async () => {
    const api = buildApi();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl() });

    expect(api.getStory).toHaveBeenCalledWith('home', 'en', 'main', 'draft');
  });

  it('maps the fetched story via mapper.mapPage', async () => {
    const api = buildApi();
    const mapper = buildMapper();
    const adapter = new StoryblokPreviewAdapter(api, mapper, silentLogger());

    await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl() });

    expect(mapper.mapPage).toHaveBeenCalledTimes(1);
  });
});

describe('StoryblokPreviewAdapter — renderPreviewPage rejection paths (→ null)', () => {
  it('returns null when the space id does not match', async () => {
    const api = buildApi();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ spaceId: '999999' }) });

    expect(el).toBeNull();
    // Step 2 short-circuits before the draft fetch.
    expect(api.getStory).not.toHaveBeenCalled();
  });

  it('returns null when the timestamp is expired (older than 1h)', async () => {
    const api = buildApi();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ ts: NOW_SECONDS - 3601 }) });

    expect(el).toBeNull();
    expect(api.getStory).not.toHaveBeenCalled();
  });

  it('returns null when a signed key is missing (presence check fails first)', async () => {
    const api = buildApi();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ omitToken: true }) });

    expect(el).toBeNull();
    expect(api.getStory).not.toHaveBeenCalled();
  });

  it('returns null when the draft story is not found (api.getStory → null)', async () => {
    const api = buildApi({ getStory: jest.fn(async () => null) });
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl() });

    expect(el).toBeNull();
  });
});

describe('StoryblokPreviewAdapter — space id unconfigured (FU-004 residual risk)', () => {
  it('still renders when getSpaceId() is null — skips the space-id check', async () => {
    const api = buildApi({ getSpaceId: jest.fn(() => null) });
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    // A *mismatching* space id in the URL must NOT cause rejection when the
    // configured id is null — the check is skipped entirely.
    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ spaceId: 'whatever' }) });

    expect(el).not.toBeNull();
    expect(isValidElement(el)).toBe(true);
    expect(api.getStory).toHaveBeenCalledWith('home', 'en', 'main', 'draft');
  });

  it('warn-logs the skipped space-id check when getSpaceId() is null', async () => {
    const api = buildApi({ getSpaceId: jest.fn(() => null) });
    const logger = silentLogger();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), logger);

    await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ spaceId: 'whatever' }) });

    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('StoryblokPreviewAdapter — edge-of-window timestamp tolerances', () => {
  it('accepts a timestamp at the 1h-past boundary (now - 3600)', async () => {
    const api = buildApi();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ ts: NOW_SECONDS - 3600 }) });

    expect(el).not.toBeNull();
  });

  it('rejects a timestamp further than 60s in the future (now + 61)', async () => {
    const api = buildApi();
    const adapter = new StoryblokPreviewAdapter(api, buildMapper(), silentLogger());

    const el = await adapter.renderPreviewPage({ ...RENDER_PARAMS, url: previewUrl({ ts: NOW_SECONDS + 61 }) });

    expect(el).toBeNull();
  });
});
