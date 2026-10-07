import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { CurrencyUrlAligner } from '@/providers/CurrencyUrlAligner';
import { SiteContext } from '@/providers/SiteProvider';

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockSetCurrency = jest.fn();
const mockNotify = jest.fn();

let mockSearch = new URLSearchParams('currency=USD');
let mockSession: { siteCode?: string; currency?: string } | null = { siteCode: 'main', currency: 'EUR' };
let mockSessionLoading = false;
let mockSite: { code: string; currencies?: Array<{ id: string }>; defaultCurrency?: { id: string } } | null = {
  code: 'main',
  defaultCurrency: { id: 'EUR' },
  currencies: [{ id: 'EUR' }, { id: 'USD' }],
};
let mockSiteLoading = false;
let mockSyncReady = true;

jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/browse',
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearch,
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({
    session: mockSession,
    loading: mockSessionLoading,
    setCurrency: mockSetCurrency,
  }),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => ({
    site: mockSite,
    loading: mockSiteLoading,
  }),
}));

jest.mock('@/hooks/common/useGlobalSyncReady', () => ({
  useGlobalSyncReady: () => ({ ready: mockSyncReady }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Info: 'info' },
  notify: (...args: unknown[]) => mockNotify(...args),
}));

jest.mock('@/lib/client/session', () => ({
  fetchCurrentSession: jest.fn().mockResolvedValue({ currency: 'EUR', siteCode: 'main' }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <SiteContext.Provider value="main">{children}</SiteContext.Provider>;
}

describe('CurrencyUrlAligner', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockRefresh.mockClear();
    mockSetCurrency.mockReset();
    mockNotify.mockClear();
    mockSearch = new URLSearchParams('currency=USD');
    mockSession = { siteCode: 'main', currency: 'EUR' };
    mockSessionLoading = false;
    mockSite = {
      code: 'main',
      defaultCurrency: { id: 'EUR' },
      currencies: [{ id: 'EUR' }, { id: 'USD' }],
    };
    mockSiteLoading = false;
    mockSyncReady = true;
    mockSetCurrency.mockResolvedValue({ success: true });
  });

  it('does nothing when the storefront URL has no currency query', async () => {
    mockSearch = new URLSearchParams('q=solar');
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does nothing when URL currency already matches the session', async () => {
    mockSession = { siteCode: 'main', currency: 'USD' };
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('applies a supported inbound currency and refreshes', async () => {
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetCurrency).toHaveBeenCalledWith('USD');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('rewrites the URL to the session currency when the code is not on the site', async () => {
    mockSearch = new URLSearchParams('q=solar&currency=GBP');
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/browse?q=solar&currency=EUR', { scroll: false });
  });

  it('rewrites the URL and toasts when cart reprice blocks the switch', async () => {
    mockSetCurrency.mockResolvedValue({ success: false, cartCurrencyBlocked: true });
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetCurrency).toHaveBeenCalledWith('USD');
    expect(mockReplace).toHaveBeenCalledWith('/browse?currency=EUR', { scroll: false });
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ title: 'currencySwitchCartBlocked' }));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('toasts the coupon-specific copy when the 409 includes coupon codes', async () => {
    mockSetCurrency.mockResolvedValue({
      success: false,
      cartCurrencyBlocked: true,
      couponCodes: ['ACCESSORIES15'],
    });
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ title: 'currencySwitchCouponBlocked' }));
  });

  it('does not apply while the URL site and session site disagree', async () => {
    mockSession = { siteCode: 'us-branch', currency: 'EUR' };
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('rewrites an invalid currency query to the session currency', async () => {
    mockSearch = new URLSearchParams('currency=FOO');
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/browse?currency=EUR', { scroll: false });
  });

  it('does not apply while global sync is not ready', async () => {
    mockSyncReady = false;
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not apply while session is loading', async () => {
    mockSessionLoading = true;
    render(
      <Wrapper>
        <CurrencyUrlAligner />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetCurrency).not.toHaveBeenCalled();
  });
});
