import { normalizeLocalizedHighlights } from './normalizeLocalizedHighlights';

describe('normalizeLocalizedHighlights', () => {
  it('returns undefined for empty or unusable input', () => {
    expect(normalizeLocalizedHighlights(undefined)).toBeUndefined();
    expect(normalizeLocalizedHighlights(null)).toBeUndefined();
    expect(normalizeLocalizedHighlights([])).toBeUndefined();
    expect(normalizeLocalizedHighlights({})).toBeUndefined();
    expect(normalizeLocalizedHighlights([{}, { language: 'en' }, { value: 'hi' }])).toBeUndefined();
    expect(normalizeLocalizedHighlights([[], [{ language: 1, value: 'x' }]])).toBeUndefined();
    expect(normalizeLocalizedHighlights(42)).toBeUndefined();
  });

  it('maps the canonical array-of-arrays payload into per-locale bullet lists in source order', () => {
    const input = [
      [
        { language: 'de', value: 'SG-Ready' },
        { language: 'en', value: 'SG-Ready' },
      ],
      [
        { language: 'de', value: 'Das ist keine Fälschung' },
        { language: 'en', value: 'This is not fake' },
      ],
      [
        { language: 'de', value: 'Energieeffizient' },
        { language: 'en', value: 'Energy efficient' },
      ],
    ];

    expect(normalizeLocalizedHighlights(input)).toEqual({
      de: ['SG-Ready', 'Das ist keine Fälschung', 'Energieeffizient'],
      en: ['SG-Ready', 'This is not fake', 'Energy efficient'],
    });
  });

  it('maps a flat Array<{ language, value: string }> without inventing missing locales', () => {
    const input = [
      { language: 'de', value: 'Highlight DE' },
      { language: 'fr', value: 'Highlight FR' },
    ];

    expect(normalizeLocalizedHighlights(input)).toEqual({
      de: ['Highlight DE'],
      fr: ['Highlight FR'],
    });
    expect(normalizeLocalizedHighlights(input)).not.toHaveProperty('en');
  });

  it('maps a flat Array<{ language, value: string[] }> like BatteryIncludedProductMapper', () => {
    const input = [
      {
        language: 'de',
        value: ['Highlight DE 1', 'Highlight DE 2'],
      },
      {
        language: 'fr',
        value: ['Highlight FR 1'],
      },
    ];

    expect(normalizeLocalizedHighlights(input)).toEqual({
      de: ['Highlight DE 1', 'Highlight DE 2'],
      fr: ['Highlight FR 1'],
    });
    expect(normalizeLocalizedHighlights(input)).not.toHaveProperty('en');
  });

  it('treats Array<string> as the en locale', () => {
    const input = ['Advanced EVA encapsulation system', 'Fortschrittliches EVA-Verguss-System'];

    expect(normalizeLocalizedHighlights(input)).toEqual({
      en: ['Advanced EVA encapsulation system', 'Fortschrittliches EVA-Verguss-System'],
    });
  });

  it('maps Record<locale, string | string[]> and omits empty locale lists', () => {
    expect(
      normalizeLocalizedHighlights({
        de: ['Highlight DE'],
        en: 'Highlight EN',
        fr: [],
        es: [1, null, 'only-string'],
      }),
    ).toEqual({
      de: ['Highlight DE'],
      en: ['Highlight EN'],
      es: ['only-string'],
    });
  });
});
