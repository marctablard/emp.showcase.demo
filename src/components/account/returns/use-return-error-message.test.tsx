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

function resolve(error: unknown): string {
  const { result } = renderHook(() => useReturnErrorMessage());
  return result.current(error);
}

describe('useReturnErrorMessage', () => {
  beforeEach(() => {
    knownKeys = ['UNEXPECTED', 'RETURNS_FETCH_FAILED', 'ITEM_EXCEEDS_RETURNABLE_QUANTITY'];
    receivedValues.mockClear();
  });

  it('translates a coded failure and passes its values to the message', () => {
    const error = new ReturnApiError('Item item-1 exceeds returnable quantity', 422, {
      code: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY',
      params: { itemId: 'item-1', requested: 2, remaining: 1 },
    });

    expect(resolve(error)).toBe('ITEM_EXCEEDS_RETURNABLE_QUANTITY({"itemId":"item-1","requested":2,"remaining":1})');
  });

  it('drops absent values instead of passing them through as undefined', () => {
    const error = new ReturnApiError('Failed to validate return request', 503, {
      code: 'RETURNS_FETCH_FAILED',
      params: { itemId: undefined, upstreamStatus: 500 },
    });

    expect(resolve(error)).toBe('RETURNS_FETCH_FAILED({"upstreamStatus":500})');
    // Asserted on the object itself, not on its JSON: JSON.stringify would hide an
    // `itemId: undefined` that actually reached next-intl.
    expect(receivedValues).toHaveBeenLastCalledWith({ upstreamStatus: 500 });
    expect(receivedValues.mock.lastCall?.[0]).not.toHaveProperty('itemId');
  });

  it('translates a coded failure that carries no values', () => {
    const error = new ReturnApiError('Failed to fetch returns', 500, { code: 'RETURNS_FETCH_FAILED' });

    expect(resolve(error)).toBe('RETURNS_FETCH_FAILED');
  });

  it('falls back to the generic message for a code the namespace does not know', () => {
    const error = new ReturnApiError('Failed to create return', 500, { code: 'UPSTREAM_UNAVAILABLE' });

    expect(resolve(error)).toBe('UNEXPECTED');
  });

  it('falls back to the generic message for a failure without a code', () => {
    expect(resolve(new ReturnApiError('boom', 500))).toBe('UNEXPECTED');
  });

  it('falls back to the generic message for anything that is not a returns API error', () => {
    expect(resolve(new Error('network down'))).toBe('UNEXPECTED');
  });
});
