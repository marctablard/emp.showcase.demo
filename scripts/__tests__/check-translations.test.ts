import {
  getVariableMappings,
  getFunctionRanges,
  extractScopedVariableKeys,
  type UsedKey,
} from '../check-translations';

function extract(source: string, relFile = 'component.tsx'): UsedKey[] {
  const lines = source.split('\n');
  const fnRanges = getFunctionRanges(lines);
  const varMappings = getVariableMappings(source);
  const result: UsedKey[] = [];
  extractScopedVariableKeys(source, lines, fnRanges, varMappings, relFile, result);
  return result;
}

describe('check-translations extraction helpers', () => {
  describe('getVariableMappings', () => {
    it('maps a simple useTranslations namespace', () => {
      const content = `const t = useTranslations('checkout');`;
      expect(getVariableMappings(content)).toEqual([
        { varName: 't', rootNs: 'checkout', subPath: '', definedLine: 1 },
      ]);
    });

    it('splits a dotted namespace into root + subPath', () => {
      const content = `const t = useTranslations('checkout.shipping');`;
      expect(getVariableMappings(content)).toEqual([
        { varName: 't', rootNs: 'checkout', subPath: 'shipping', definedLine: 1 },
      ]);
    });

    it('supports await getTranslations with a string namespace', () => {
      const content = `const tOrders = await getTranslations('orders');`;
      expect(getVariableMappings(content)).toEqual([
        { varName: 'tOrders', rootNs: 'orders', subPath: '', definedLine: 1 },
      ]);
    });

    it('supports the getTranslations object form with namespace property', () => {
      const content = `const t = await getTranslations({ locale, namespace: 'orders.Approval' });`;
      expect(getVariableMappings(content)).toEqual([
        { varName: 't', rootNs: 'orders', subPath: 'Approval', definedLine: 1 },
      ]);
    });

    it('captures multiple mappings and their correct line numbers', () => {
      const content = [
        `import { useTranslations } from 'next-intl';`,
        ``,
        `const t = useTranslations('footer');`,
        `const nav = useTranslations('header.nav');`,
      ].join('\n');

      expect(getVariableMappings(content)).toEqual([
        { varName: 't', rootNs: 'footer', subPath: '', definedLine: 3 },
        { varName: 'nav', rootNs: 'header', subPath: 'nav', definedLine: 4 },
      ]);
    });

    it('returns an empty array when no translation hooks are present', () => {
      expect(getVariableMappings(`const x = doSomething('nope');`)).toEqual([]);
    });
  });

  describe('extractScopedVariableKeys', () => {
    it('scopes keys to the function they are declared in (no cross-contamination)', () => {
      const source = [
        'function Footer() {', // 1
        "  const t = useTranslations('footer');", // 2
        "  return t('copyright');", // 3
        '}', // 4
        '', // 5
        'function Header() {', // 6
        "  const t = useTranslations('header.nav');", // 7
        "  return t('title');", // 8
        '}', // 9
      ].join('\n');

      expect(extract(source)).toEqual([
        { namespace: 'footer', subPath: '', key: 'copyright', file: 'component.tsx', line: 3 },
        { namespace: 'header', subPath: 'nav', key: 'title', file: 'component.tsx', line: 8 },
      ]);
    });

    it('matches member-call forms such as t.rich()', () => {
      const source = [
        'function Banner() {', //
        "  const t = useTranslations('banner');", //
        "  return t.rich('promo');", //
        '}', //
      ].join('\n');

      expect(extract(source)).toEqual([
        { namespace: 'banner', subPath: '', key: 'promo', file: 'component.tsx', line: 3 },
      ]);
    });

    it('skips dynamic keys (template literals and concatenation)', () => {
      const source = [
        'function Dynamic() {', //
        "  const t = useTranslations('dynamic');", //
        '  const a = t(`prefix.${id}`);', //
        "  const b = t('prefix.' + id);", //
        "  return t('static.key');", //
        '}', //
      ].join('\n');

      expect(extract(source)).toEqual([
        { namespace: 'dynamic', subPath: '', key: 'static.key', file: 'component.tsx', line: 5 },
      ]);
    });

    it('falls back to whole-file search for module-scope variables', () => {
      const source = [
        "const t = useTranslations('global');", //
        "export const label = t('menu.label');", //
      ].join('\n');

      expect(extract(source)).toEqual([
        { namespace: 'global', subPath: '', key: 'menu.label', file: 'component.tsx', line: 2 },
      ]);
    });
  });
});
