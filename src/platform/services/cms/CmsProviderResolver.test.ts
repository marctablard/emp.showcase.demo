/**
 * `CmsProviderResolver` reads the runtime env and decides which CMS adapter
 * to bind. The matrix below pins every branch in the resolution rules.
 *
 * Tier: Platform tests (Jest `Platform Tests` project, node env).
 */
import { CMS_PROVIDER_IDS, resolveCmsProvider } from './CmsProviderResolver';

function buildEnv(partial: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  // Start from an empty env so each row in the matrix is hermetic.
  return { ...partial } as NodeJS.ProcessEnv;
}

describe('resolveCmsProvider', () => {
  describe('auto-resolution (NEXT_PUBLIC_CMS_PROVIDER unset)', () => {
    it('falls back to "none" when neither provider nor Storyblok token is set', () => {
      const env = buildEnv({});

      expect(resolveCmsProvider(env)).toBe('none');
    });

    it('picks "storyblok" when only the Storyblok token is set', () => {
      const env = buildEnv({ NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN: 'abc' });

      expect(resolveCmsProvider(env)).toBe('storyblok');
    });
  });

  describe('explicit override', () => {
    it('honors NEXT_PUBLIC_CMS_PROVIDER="storyblok" even without a token', () => {
      const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: 'storyblok' });

      expect(resolveCmsProvider(env)).toBe('storyblok');
    });

    it('honors NEXT_PUBLIC_CMS_PROVIDER="local"', () => {
      const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: 'local' });

      expect(resolveCmsProvider(env)).toBe('local');
    });

    it('honors NEXT_PUBLIC_CMS_PROVIDER="none" even when a Storyblok token is present (explicit > auto)', () => {
      const env = buildEnv({
        NEXT_PUBLIC_CMS_PROVIDER: 'none',
        NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN: 'abc',
      });

      expect(resolveCmsProvider(env)).toBe('none');
    });
  });

  describe('robustness', () => {
    it('treats an unknown provider value as auto-resolution → "none"', () => {
      const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: 'invalid' });

      expect(resolveCmsProvider(env)).toBe('none');
    });

    it('treats a whitespace-only provider value as auto-resolution → "none"', () => {
      const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: '   ' });

      expect(resolveCmsProvider(env)).toBe('none');
    });

    it('trims surrounding whitespace from the provider value', () => {
      const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: '  storyblok  ' });

      expect(resolveCmsProvider(env)).toBe('storyblok');
    });

    it('treats a whitespace-only Storyblok token as missing (auto → "none")', () => {
      const env = buildEnv({ NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN: '   ' });

      expect(resolveCmsProvider(env)).toBe('none');
    });

    it('uses `process.env` when no env argument is supplied', () => {
      const original = process.env.NEXT_PUBLIC_CMS_PROVIDER;
      process.env.NEXT_PUBLIC_CMS_PROVIDER = 'local';
      try {
        expect(resolveCmsProvider()).toBe('local');
      } finally {
        if (original === undefined) {
          delete process.env.NEXT_PUBLIC_CMS_PROVIDER;
        } else {
          process.env.NEXT_PUBLIC_CMS_PROVIDER = original;
        }
      }
    });

    it('accepts every id listed in `CMS_PROVIDER_IDS` as an explicit override', () => {
      // Drift-guard: the canonical ids list and the resolver guard must stay
      // in sync. Adding a new id to `CMS_PROVIDER_IDS` without updating the
      // resolver branch will trip this assertion.
      for (const id of CMS_PROVIDER_IDS) {
        const env = buildEnv({ NEXT_PUBLIC_CMS_PROVIDER: id });

        expect(resolveCmsProvider(env)).toBe(id);
      }
    });
  });
});
