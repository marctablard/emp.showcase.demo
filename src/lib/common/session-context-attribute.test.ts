import { readSessionContextAttributeValue } from './session-context-attribute';

describe('readSessionContextAttributeValue', () => {
  it('reads plain string attributes', () => {
    expect(readSessionContextAttributeValue({ legalEntityId: '  le-1 ' }, 'legalEntityId')).toBe('le-1');
  });

  it('reads attribute objects with a value field', () => {
    expect(
      readSessionContextAttributeValue({ legalEntityId: { key: 'legalEntityId', value: 'le-2' } }, 'legalEntityId'),
    ).toBe('le-2');
  });

  it('returns undefined for missing or blank values', () => {
    expect(readSessionContextAttributeValue(undefined, 'legalEntityId')).toBeUndefined();
    expect(readSessionContextAttributeValue({ legalEntityId: '   ' }, 'legalEntityId')).toBeUndefined();
  });
});
