import { isTransientEmporixError, retryOnTransientEmporixError } from './emporix-integration-retry';

describe('emporix-integration-retry', () => {
  it('detects gateway timeout / TARGET_READ_TIMEOUT as transient', () => {
    expect(
      isTransientEmporixError(
        new Error(
          'Failed to guest checkout: Gateway Timeout {"fault":{"faultstring":"Gateway Timeout","detail":{"reason":"TARGET_READ_TIMEOUT"}}}',
        ),
      ),
    ).toBe(true);
    expect(isTransientEmporixError(new Error('Failed to guest checkout. Gateway Timeout'))).toBe(true);
    expect(isTransientEmporixError(new Error('HTTP 504'))).toBe(true);
    expect(isTransientEmporixError(new Error('Cart not found'))).toBe(false);
  });

  it('retries transient failures then returns success', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Gateway Timeout TARGET_READ_TIMEOUT'))
      .mockRejectedValueOnce(new Error('504 Gateway Timeout'))
      .mockResolvedValueOnce('ok');

    await expect(retryOnTransientEmporixError(operation, { baseDelayMs: 1 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-transient errors', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Cart not found'));

    await expect(retryOnTransientEmporixError(operation, { baseDelayMs: 1 })).rejects.toThrow('Cart not found');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
