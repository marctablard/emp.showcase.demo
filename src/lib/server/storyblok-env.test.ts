/**
 * Dual naming for Storyblok/CMS env keys (SHOW-323 legacy compat).
 *
 * Tier: Library tests (Jest `Library Tests` project, node env).
 * Exercises the server re-export path (includes `server-only` mock).
 */
import { getCmsEnv, getStoryblokEnv } from './storyblok-env';

function buildEnv(partial: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { ...partial } as NodeJS.ProcessEnv;
}

describe('getStoryblokEnv', () => {
  it('prefers NEXT_STORYBLOK_* when both preferred and legacy PUBLIC are set', () => {
    const env = buildEnv({
      NEXT_STORYBLOK_ACCESS_TOKEN: 'server-token',
      NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN: 'public-token',
    });

    expect(getStoryblokEnv('ACCESS_TOKEN', env)).toBe('server-token');
  });

  it('falls back to NEXT_PUBLIC_STORYBLOK_* when only PUBLIC is set', () => {
    const env = buildEnv({
      NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN: 'public-token',
    });

    expect(getStoryblokEnv('ACCESS_TOKEN', env)).toBe('public-token');
  });

  it('returns undefined when neither key is set', () => {
    expect(getStoryblokEnv('ACCESS_TOKEN', buildEnv({}))).toBeUndefined();
  });

  it('treats whitespace-only preferred as unset and falls back to PUBLIC', () => {
    const env = buildEnv({
      NEXT_STORYBLOK_ACCESS_TOKEN: '   ',
      NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN: 'public-token',
    });

    expect(getStoryblokEnv('ACCESS_TOKEN', env)).toBe('public-token');
  });

  it('trims surrounding whitespace from the winning value', () => {
    const env = buildEnv({ NEXT_STORYBLOK_SPACE_ID: '  338074  ' });

    expect(getStoryblokEnv('SPACE_ID', env)).toBe('338074');
  });

  it.each([
    ['ACCESS_TOKEN', 'NEXT_STORYBLOK_ACCESS_TOKEN', 'NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN'],
    ['SPACE_ID', 'NEXT_STORYBLOK_SPACE_ID', 'NEXT_PUBLIC_STORYBLOK_SPACE_ID'],
    ['MULTI_SITE', 'NEXT_STORYBLOK_MULTI_SITE', 'NEXT_PUBLIC_STORYBLOK_MULTI_SITE'],
    ['ACCESS_PREVIEW', 'NEXT_STORYBLOK_ACCESS_PREVIEW', 'NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW'],
  ] as const)('resolves %s via preferred then legacy keys', (suffix, preferredKey, legacyKey) => {
    expect(getStoryblokEnv(suffix, buildEnv({ [preferredKey]: 'preferred' }))).toBe('preferred');
    expect(getStoryblokEnv(suffix, buildEnv({ [legacyKey]: 'legacy' }))).toBe('legacy');
    expect(
      getStoryblokEnv(
        suffix,
        buildEnv({
          [preferredKey]: 'preferred',
          [legacyKey]: 'legacy',
        }),
      ),
    ).toBe('preferred');
  });
});

describe('getCmsEnv', () => {
  it('prefers NEXT_CMS_* when both preferred and legacy PUBLIC are set', () => {
    const env = buildEnv({
      NEXT_CMS_PROVIDER: 'local',
      NEXT_PUBLIC_CMS_PROVIDER: 'storyblok',
    });

    expect(getCmsEnv('PROVIDER', env)).toBe('local');
  });

  it('falls back to NEXT_PUBLIC_CMS_* when only PUBLIC is set', () => {
    const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: 'storyblok' });

    expect(getCmsEnv('PROVIDER', env)).toBe('storyblok');
  });

  it.each([
    ['PROVIDER', 'NEXT_CMS_PROVIDER', 'NEXT_PUBLIC_CMS_PROVIDER'],
    ['FALLBACK_PROVIDER', 'NEXT_CMS_FALLBACK_PROVIDER', 'NEXT_PUBLIC_CMS_FALLBACK_PROVIDER'],
    ['LOCAL_DEFAULT_SITE', 'NEXT_CMS_LOCAL_DEFAULT_SITE', 'NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE'],
    ['PAGE_CACHE_TTL_MS', 'NEXT_CMS_PAGE_CACHE_TTL_MS', 'NEXT_PUBLIC_CMS_PAGE_CACHE_TTL_MS'],
    ['LAYOUT_CACHE_TTL_MS', 'NEXT_CMS_LAYOUT_CACHE_TTL_MS', 'NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS'],
  ] as const)('resolves %s via preferred then legacy keys', (suffix, preferredKey, legacyKey) => {
    expect(getCmsEnv(suffix, buildEnv({ [preferredKey]: 'preferred' }))).toBe('preferred');
    expect(getCmsEnv(suffix, buildEnv({ [legacyKey]: 'legacy' }))).toBe('legacy');
  });
});
