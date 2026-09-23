import { render } from '@testing-library/react';
import { CurrencyCookieAligner } from '@/providers/CurrencyCookieAligner';

const fetchCurrentSession = jest.fn();

let mockSession: { currency?: string } | null = { currency: 'EUR' };
let mockLoading = false;

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({
    session: mockSession,
    loading: mockLoading,
  }),
}));

jest.mock('@/lib/client/session', () => ({
  fetchCurrentSession: (...args: unknown[]) => fetchCurrentSession(...args),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    warn: jest.fn(),
  }),
}));

describe('CurrencyCookieAligner', () => {
  beforeEach(() => {
    fetchCurrentSession.mockReset();
    fetchCurrentSession.mockResolvedValue({ currency: 'EUR' });
    mockSession = { currency: 'EUR' };
    mockLoading = false;
    document.cookie = 'next-currency=; Max-Age=0; path=/';
  });

  it('leaves a cookie that already matches the session', () => {
    document.cookie = 'next-currency=EUR';
    render(<CurrencyCookieAligner />);
    expect(fetchCurrentSession).not.toHaveBeenCalled();
  });

  it('asks GET /api/session to rewrite a disagreeing cookie', () => {
    document.cookie = 'next-currency=USD';
    render(<CurrencyCookieAligner />);
    expect(fetchCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('asks GET /api/session to write the cookie when it is missing', () => {
    render(<CurrencyCookieAligner />);
    expect(fetchCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('treats a malformed cookie as a mismatch instead of throwing', () => {
    document.cookie = 'next-currency=%E0%A4%A';
    expect(() => render(<CurrencyCookieAligner />)).not.toThrow();
    expect(fetchCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while the session is still loading', () => {
    mockLoading = true;
    document.cookie = 'next-currency=USD';
    render(<CurrencyCookieAligner />);
    expect(fetchCurrentSession).not.toHaveBeenCalled();
  });
});
