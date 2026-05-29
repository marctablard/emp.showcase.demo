/**
 * Integration test — webhook→cache key congruence (EMP-14 §2 cache-roundtrip).
 *
 * The facade-level unit tests mock `mapWebhookPayload`, so they prove the
 * facade invalidates *whatever key the mapper returns* — but NOT that the REAL
 * Storyblok mapper produces the SAME (slug, locale, site) tuple that the read
 * path cached. A divergence there (e.g. webhook emits `site: ''` while reads
 * cache under the real route-segment site code) would invalidate nothing in
 * production while every mocked test stays green.
 *
 * This test wires the REAL `StoryblokCmsAdapter` (real `mapWebhookPayload` +
 * real HMAC `validateWebhookSignature`) into the REAL `DelegatingCmsServiceSSR`
 * and the REAL `globalThis` cache, then asserts the end-to-end round-trip in
 * both single-site and multi-site spaces: warm → webhook → cold.
 */
import crypto from 'crypto';
import type { StoryblokCmsApi, StoryblokStoryResult } from '@/platform/integrations/storyblok/cms/StoryblokCmsApi';
import { StoryblokCmsAdapter } from '@/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter';
import type { StoryblokCmsMapper } from '@/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSPage } from '../../model/cms';
import { __resetCmsCache } from '../cms-cache';
import { DelegatingCmsServiceSSR } from './DelegatingCmsServiceSSR';

const WEBHOOK_SECRET = 'integration-secret';

const sign = (rawBody: string): string =>
  crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');

const silentLogger = (): jest.Mocked<LoggerService> =>
  ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

const SAMPLE_PAGE: CMSPage = { title: 'Home', description: 'Landing', url: 'home', components: [] };

const story = (): StoryblokStoryResult =>
  ({
    data: { story: { id: 1, slug: 'home', full_slug: 'home', name: 'Home', content: { body: [] } } },
  }) as unknown as StoryblokStoryResult;

function buildService(): { service: DelegatingCmsServiceSSR; getStory: jest.Mock } {
  const getStory = jest.fn(async () => story());
  const api = { hasToken: jest.fn(() => true), getStory } as unknown as jest.Mocked<StoryblokCmsApi>;
  const mapper = {
    mapPage: jest.fn(() => SAMPLE_PAGE),
    mapLayout: jest.fn(),
    mapRichtext: jest.fn(),
  } as unknown as jest.Mocked<StoryblokCmsMapper>;
  const adapter = new StoryblokCmsAdapter(api, mapper, silentLogger());
  return { service: new DelegatingCmsServiceSSR(adapter), getStory };
}

const webhookRequest = (payload: Record<string, unknown>): Request => {
  const rawBody = JSON.stringify(payload);
  return {
    text: jest.fn(async () => rawBody),
    headers: new Headers({ 'webhook-signature': sign(rawBody) }),
  } as unknown as Request;
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetCmsCache();
  process.env = { ...ORIGINAL_ENV };
  process.env.NEXT_CMS_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('webhook→cache key congruence — single-site space', () => {
  it('invalidates the exact key the read path cached (real mapper, real cache)', async () => {
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';
    const { service, getStory } = buildService();

    // Warm: two reads of the same (slug, locale, site) → adapter hit ONCE.
    await service.getPage('home', 'de', 'main');
    await service.getPage('home', 'de', 'main');
    expect(getStory).toHaveBeenCalledTimes(1);

    // Webhook with a prefix-less slug — must fan out to the real site code
    // ('main') so the produced key matches the cached read key.
    const result = await service.handleWebhook!(webhookRequest({ action: 'published', full_slug: 'home' }));
    expect(result.status).toBe(200);

    // Cold: the cached entry is gone → adapter hit AGAIN.
    await service.getPage('home', 'de', 'main');
    expect(getStory).toHaveBeenCalledTimes(2);
  });

  it('rejects a tampered body with 401 and leaves the cache intact', async () => {
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';
    const { service, getStory } = buildService();

    await service.getPage('home', 'de', 'main');
    expect(getStory).toHaveBeenCalledTimes(1);

    const rawBody = JSON.stringify({ action: 'published', full_slug: 'home' });
    const forged = {
      text: jest.fn(async () => rawBody),
      headers: new Headers({ 'webhook-signature': sign('different-body') }),
    } as unknown as Request;
    const result = await service.handleWebhook!(forged);
    expect(result.status).toBe(401);

    // Cache untouched → still a hit.
    await service.getPage('home', 'de', 'main');
    expect(getStory).toHaveBeenCalledTimes(1);
  });
});

describe('webhook→cache key congruence — multi-site space', () => {
  it('invalidates only the addressed site from the slug prefix', async () => {
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main,us-branch';
    process.env.NEXT_PUBLIC_STORYBLOK_MULTI_SITE = 'true';
    const { service, getStory } = buildService();

    // Warm both sites.
    await service.getPage('home', 'de', 'us-branch');
    await service.getPage('home', 'de', 'main');
    expect(getStory).toHaveBeenCalledTimes(2);

    // Webhook addresses us-branch/de/home explicitly.
    const result = await service.handleWebhook!(
      webhookRequest({ action: 'published', full_slug: 'us-branch/de/home' }),
    );
    expect(result.status).toBe(200);

    // us-branch re-hits, main stays cached.
    await service.getPage('home', 'de', 'us-branch');
    expect(getStory).toHaveBeenCalledTimes(3);
    await service.getPage('home', 'de', 'main');
    expect(getStory).toHaveBeenCalledTimes(3);
  });
});
