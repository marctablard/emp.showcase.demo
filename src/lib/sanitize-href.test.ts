import { sanitizeHref } from './sanitize-href';

describe('sanitizeHref', () => {
  describe('allowlist — safe schemes pass through unchanged', () => {
    it.each([
      ['https://example.com/path', 'https://example.com/path'],
      ['http://example.com', 'http://example.com'],
      ['mailto:user@example.com', 'mailto:user@example.com'],
      ['tel:+49301234567', 'tel:+49301234567'],
      ['/internal/page', '/internal/page'],
      ['/', '/'],
      ['#anchor', '#anchor'],
      ['#', '#'],
    ])('keeps %p as %p', (input, expected) => {
      expect(sanitizeHref(input)).toBe(expected);
    });

    it('is case-insensitive for the scheme match', () => {
      expect(sanitizeHref('HTTPS://example.com')).toBe('HTTPS://example.com');
      expect(sanitizeHref('MailTo:user@example.com')).toBe('MailTo:user@example.com');
    });

    it('trims leading and trailing ASCII whitespace before matching', () => {
      expect(sanitizeHref('  https://example.com  ')).toBe('https://example.com');
      expect(sanitizeHref('\t/internal\n')).toBe('/internal');
    });
  });

  describe('blocklist — dangerous schemes are neutralised to ""', () => {
    it.each([
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      '\tjavascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com',
      'about:blank',
    ])('rejects %p', (input) => {
      expect(sanitizeHref(input)).toBe('');
    });

    it('rejects bare scheme without payload', () => {
      expect(sanitizeHref('javascript:')).toBe('');
    });

    it('rejects empty string', () => {
      expect(sanitizeHref('')).toBe('');
    });

    it('rejects whitespace-only string', () => {
      expect(sanitizeHref('   ')).toBe('');
    });
  });

  describe('null-safety — non-strings are normalised to ""', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('returns "" for %s', (_label, input) => {
      expect(sanitizeHref(input)).toBe('');
    });

    it('returns "" for a number coerced through the API', () => {
      // Belt-and-braces against accidental TS bypass via `as any` at a call site.
      expect(sanitizeHref(42 as unknown as string)).toBe('');
    });

    it('returns "" for an object coerced through the API', () => {
      expect(sanitizeHref({ toString: () => 'javascript:alert(1)' } as unknown as string)).toBe('');
    });
  });
});
