import { act, renderHook } from '@testing-library/react';
import { useRegistration } from './useRegistration';

describe('useRegistration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns success with userId when API returns session body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'sess-1',
        customerId: 'cust-1',
        siteCode: 'main',
      }),
    });

    const { result } = renderHook(() => useRegistration());

    let out: { success: boolean; userId?: string; error?: string } | undefined;
    await act(async () => {
      out = await result.current.register({
        credentials: { username: 'new@example.com', password: 'Secret1a' },
      });
    });

    expect(out?.success).toBe(true);
    expect(out?.userId).toBe('cust-1');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('returns failure when API responds with error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'EMAIL_EXISTS' }),
    });

    const { result } = renderHook(() => useRegistration());

    let out: { success: boolean; userId?: string; error?: string } | undefined;
    await act(async () => {
      out = await result.current.register({
        credentials: { username: 'taken@example.com', password: 'Secret1a' },
      });
    });

    expect(out?.success).toBe(false);
    expect(out?.error).toBe('EMAIL_EXISTS');
  });
});
