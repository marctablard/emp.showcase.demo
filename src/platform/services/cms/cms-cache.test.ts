/**
 * Unit tests for the `globalThis`-backed CMS content cache.
 *
 * Pins:
 * - round-trip set/get for pages and layouts, keyed by (slug|layoutId, locale, site);
 * - keys are isolated across the three dimensions and across the page/layout stores;
 * - TTL expiry (default 1h, env-overridable) evicts entries;
 * - invalid / non-positive TTL env falls back to the 1h default;
 * - `invalidatePage` / `invalidateLayout` drop exactly the addressed key.
 */
import type { CMSLayout, CMSPage } from '../model/cms';
import {
  __resetCmsCache,
  getCachedLayout,
  getCachedPage,
  invalidateLayout,
  invalidatePage,
  setCachedLayout,
  setCachedPage,
} from './cms-cache';

const PAGE: CMSPage = { title: 'Home', description: 'Landing', url: '/', components: [] };
const LAYOUT: CMSLayout = { id: 'l-1', type: 'layout', body: [] };

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetCmsCache();
  jest.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_CMS_PAGE_CACHE_TTL_MS;
  delete process.env.NEXT_CMS_LAYOUT_CACHE_TTL_MS;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('page cache', () => {
  it('returns undefined on a miss and the stored page on a hit', () => {
    expect(getCachedPage('home', 'de', 'main')).toBeUndefined();
    setCachedPage('home', 'de', 'main', PAGE);
    expect(getCachedPage('home', 'de', 'main')).toBe(PAGE);
  });

  it('isolates entries across slug, locale and site', () => {
    setCachedPage('home', 'de', 'main', PAGE);
    expect(getCachedPage('about', 'de', 'main')).toBeUndefined();
    expect(getCachedPage('home', 'en', 'main')).toBeUndefined();
    expect(getCachedPage('home', 'de', 'us-branch')).toBeUndefined();
  });

  it('evicts an entry once its TTL has elapsed', () => {
    jest.useFakeTimers();
    process.env.NEXT_CMS_PAGE_CACHE_TTL_MS = '1000';
    setCachedPage('home', 'de', 'main', PAGE);
    expect(getCachedPage('home', 'de', 'main')).toBe(PAGE);
    jest.advanceTimersByTime(1001);
    expect(getCachedPage('home', 'de', 'main')).toBeUndefined();
  });

  it('falls back to the 1h default when the TTL env is non-positive or invalid', () => {
    jest.useFakeTimers();
    process.env.NEXT_CMS_PAGE_CACHE_TTL_MS = '-5';
    setCachedPage('home', 'de', 'main', PAGE);
    jest.advanceTimersByTime(3_600_000 - 1);
    expect(getCachedPage('home', 'de', 'main')).toBe(PAGE);
    jest.advanceTimersByTime(2);
    expect(getCachedPage('home', 'de', 'main')).toBeUndefined();
  });
});

describe('layout cache', () => {
  it('round-trips a layout and is independent of the page store', () => {
    setCachedPage('default', 'de', 'main', PAGE);
    expect(getCachedLayout('default', 'de', 'main')).toBeUndefined();
    setCachedLayout('default', 'de', 'main', LAYOUT);
    expect(getCachedLayout('default', 'de', 'main')).toBe(LAYOUT);
    expect(getCachedPage('default', 'de', 'main')).toBe(PAGE);
  });
});

describe('invalidation', () => {
  it('invalidatePage drops exactly the addressed key', () => {
    setCachedPage('home', 'de', 'main', PAGE);
    setCachedPage('home', 'en', 'main', PAGE);
    invalidatePage('home', 'de', 'main');
    expect(getCachedPage('home', 'de', 'main')).toBeUndefined();
    expect(getCachedPage('home', 'en', 'main')).toBe(PAGE);
  });

  it('invalidateLayout drops exactly the addressed key', () => {
    setCachedLayout('default', 'de', 'main', LAYOUT);
    setCachedLayout('marketing', 'de', 'main', LAYOUT);
    invalidateLayout('default', 'de', 'main');
    expect(getCachedLayout('default', 'de', 'main')).toBeUndefined();
    expect(getCachedLayout('marketing', 'de', 'main')).toBe(LAYOUT);
  });
});
