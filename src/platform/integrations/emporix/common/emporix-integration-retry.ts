/**
 * Retry helper for live Emporix integration tests.
 * Transient Apigee/upstream timeouts (504 / TARGET_READ_TIMEOUT) are common in CI
 * and should not fail the suite on a single attempt.
 */

const TRANSIENT_EMPORIX_ERROR =
  /Gateway Timeout|TARGET_READ_TIMEOUT|\b504\b|ECONNRESET|ETIMEDOUT|socket hang up|network timeout/i;

export function isTransientEmporixError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_EMPORIX_ERROR.test(message);
}

export async function retryOnTransientEmporixError<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientEmporixError(error) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }

  throw lastError;
}
