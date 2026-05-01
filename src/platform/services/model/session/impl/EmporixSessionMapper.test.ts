import type { EmporixSessionContext } from '@/platform/integrations/emporix/model/session-context';
import { EmporixSessionMapper } from './EmporixSessionMapper';

describe('EmporixSessionMapper', () => {
  let mapper: EmporixSessionMapper;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Public-default helpers throw when these are unset; seed them for the mapper defaults.
    process.env.NEXT_PUBLIC_DEFAULT_SITE = 'main';
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY = 'EUR';
    mapper = new EmporixSessionMapper();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('mapToService language handling (2026-04-21 BE change)', () => {
    it('prefers the top-level `language` field when present', () => {
      const source: EmporixSessionContext = {
        sessionId: 'sess-1',
        siteCode: 'main',
        currency: 'EUR',
        language: 'de',
        context: { language: 'en' }, // Legacy fallback must be ignored when top-level is set.
      };

      const result = mapper.mapToService(source);

      expect(result.language).toBe('de');
    });

    it('falls back to the legacy `context.language` attribute for sessions created before the BE change', () => {
      const source: EmporixSessionContext = {
        sessionId: 'sess-2',
        siteCode: 'main',
        currency: 'EUR',
        context: { language: 'fr' },
      };

      const result = mapper.mapToService(source);

      expect(result.language).toBe('fr');
    });

    it('leaves language undefined when neither top-level nor context carries it', () => {
      const source: EmporixSessionContext = {
        sessionId: 'sess-3',
        siteCode: 'main',
        currency: 'EUR',
      };

      const result = mapper.mapToService(source);

      expect(result.language).toBeUndefined();
    });
  });
});
