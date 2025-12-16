import { act, renderHook } from '@testing-library/react';
import { useRateLimit } from './useRateLimit';

describe('useRateLimit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 3, windowMs: 1000 }));

    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(true);
  });

  it('should block requests over limit', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 2, windowMs: 1000 }));

    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(false);
  });

  it('should allow requests after window expires', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 2, windowMs: 1000 }));

    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(false);

    // Advance time past the window
    act(() => {
      jest.advanceTimersByTime(1001);
    });

    expect(result.current.checkRateLimit()).toBe(true);
  });

  it('should report remaining requests correctly', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 3, windowMs: 1000 }));

    expect(result.current.getRemainingRequests()).toBe(3);

    result.current.checkRateLimit();
    expect(result.current.getRemainingRequests()).toBe(2);

    result.current.checkRateLimit();
    expect(result.current.getRemainingRequests()).toBe(1);

    result.current.checkRateLimit();
    expect(result.current.getRemainingRequests()).toBe(0);
  });

  it('should reset remaining after window expires', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 2, windowMs: 1000 }));

    result.current.checkRateLimit();
    result.current.checkRateLimit();
    expect(result.current.getRemainingRequests()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1001);
    });

    expect(result.current.getRemainingRequests()).toBe(2);
  });

  it('should reset counter with reset function', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 2, windowMs: 1000 }));

    result.current.checkRateLimit();
    result.current.checkRateLimit();
    expect(result.current.checkRateLimit()).toBe(false);

    act(() => {
      result.current.reset();
    });

    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.getRemainingRequests()).toBe(1);
  });

  it('should handle sliding window correctly', () => {
    const { result } = renderHook(() => useRateLimit({ maxRequests: 2, windowMs: 1000 }));

    // First request at t=0
    result.current.checkRateLimit();

    // Advance 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Second request at t=500
    result.current.checkRateLimit();
    expect(result.current.checkRateLimit()).toBe(false);

    // Advance to t=1001 - first request should expire
    act(() => {
      jest.advanceTimersByTime(501);
    });

    // Now we should have room for one more
    expect(result.current.checkRateLimit()).toBe(true);
  });
});
