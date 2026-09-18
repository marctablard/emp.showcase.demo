/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { ReturnApiError } from '@/lib/client/returns';
import { useReturnErrorMessage } from './use-return-error-message';

let knownKeys: string[] = [];
const receivedValues = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign(
      (key: string, values?: Record<string, string | number>) => {
        receivedValues(values);
        return values && Object.keys(values).length > 0 ? `${key}(${JSON.stringify(values)})` : key;
      },
      { has: (key: string) => knownKeys.includes(key) },
    ),
}));

function resolve(error: unknown): string | undefined {
  const { result } = renderHook(() => useReturnErrorMessage());
  return result.current(error);
}

describe('useReturnErrorMessage', () => {
  beforeEach(() => {
    knownKeys = ['RETURNS_FETCH_FAILED', 'ITEM_EXCEEDS_RETURNABLE_QUANTITY'];
    receivedValues.mockClear();
  });

  it('translates a coded failure and passes its values to the message', () => {
    const error = new ReturnApiError('Item ART-4711 exceeds returnable quantity', 422, {
      code: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY',
      params: { sku: 'ART-4711', requested: 2, remaining: 1 },
    });

    expect(resolve(error)).toBe('ITEM_EXCEEDS_RETURNABLE_QUANTITY({"sku":"ART-4711","requested":2,"remaining":1})');
  });

  it('drops absent values instead of passing them through as undefined', () => {
    const error = new ReturnApiError('Failed to fetch returns', 500, {
      code: 'RETURNS_FETCH_FAILED',
      params: { sku: undefined, remaining: 1 },
    });

    expect(resolve(error)).toBe('RETURNS_FETCH_FAILED({"remaining":1})');
    // Asserted on the object itself, not on its JSON: JSON.stringify would hide a
    // `sku: undefined` that actually reached next-intl.
    expect(receivedValues).toHaveBeenLastCalledWith({ remaining: 1 });
    expect(receivedValues.mock.lastCall?.[0]).not.toHaveProperty('sku');
  });

  it('translates a coded failure that carries no values', () => {
    const error = new ReturnApiError('Failed to fetch returns', 500, { code: 'RETURNS_FETCH_FAILED' });

    expect(resolve(error)).toBe('RETURNS_FETCH_FAILED');
  });

  it('yields nothing for a code the namespace does not know, so the surface can supply its own text', () => {
    const error = new ReturnApiError('Failed to create return', 500, { code: 'UPSTREAM_UNAVAILABLE' });

    expect(resolve(error)).toBeUndefined();
  });

  it('yields nothing for a failure without a code', () => {
    expect(resolve(new ReturnApiError('boom', 500))).toBeUndefined();
  });

  it('yields nothing for anything that is not a returns API error', () => {
    expect(resolve(new Error('network down'))).toBeUndefined();
  });
});
