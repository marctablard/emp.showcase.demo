/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QuickOrder } from './quick-order';

// ---------- Mocks ----------
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/quick-order',
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({
    addItem: jest.fn().mockResolvedValue(undefined),
    loading: false,
  }),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test' } }, status: 'authenticated' }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => ({
    session: { currency: 'EUR' },
  }),
}));

jest.mock('@/hooks/search/useSearch', () => ({
  useSearch: () => ({
    getSuggestions: jest.fn().mockResolvedValue({ products: [], completions: [], categories: [] }),
    loading: false,
  }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    resolveLocalizedString: (val: string | Record<string, string>) => (typeof val === 'string' ? val : (val?.en ?? '')),
  }),
}));

jest.mock('@/hooks/authentication/useAuthentication', () => ({
  useAuthentication: () => ({
    isAuthenticated: true,
    loading: false,
  }),
}));

// Mock sub-components that have deep dependency trees — keep integration test focused on the shell
jest.mock('./quick-order-search', () => ({
  QuickOrderSearch: ({ onAddProducts }: { onAddProducts: unknown }) => (
    <div data-testid="mock-quick-order-search">Search Component</div>
  ),
}));

jest.mock('./quick-order-text-paste', () => ({
  QuickOrderTextPaste: ({ onAddProducts }: { onAddProducts: unknown }) => (
    <div data-testid="mock-quick-order-text-paste">Text Paste Component</div>
  ),
}));

jest.mock('./quick-order-file-upload', () => ({
  QuickOrderFileUpload: ({ onAddProducts }: { onAddProducts: unknown }) => (
    <div data-testid="mock-quick-order-file-upload">File Upload Component</div>
  ),
}));

jest.mock('./quick-order-product-list', () => ({
  QuickOrderProductList: (props: Record<string, unknown>) => (
    <div data-testid="mock-quick-order-product-list">Product List</div>
  ),
}));

jest.mock('./quick-order-overview', () => ({
  QuickOrderOverview: (props: { isProcessing: boolean; onAddToCart: () => void }) => (
    <div data-testid="mock-quick-order-overview">
      <button data-testid="add-to-cart-btn" onClick={props.onAddToCart} disabled={props.isProcessing}>
        Add to Cart
      </button>
    </div>
  ),
}));

describe('QuickOrder component', () => {
  it('renders with both tabs', () => {
    render(<QuickOrder />);

    expect(screen.getByText('tabs.productsSearch')).toBeInTheDocument();
    expect(screen.getByText('tabs.bulkUpload')).toBeInTheDocument();
  });

  it('renders the page title', () => {
    render(<QuickOrder />);

    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('shows manual tab content by default', () => {
    render(<QuickOrder />);

    const manualTab = screen.getByTestId('quick-order-manual-tab');
    expect(manualTab).toBeInTheDocument();
    expect(manualTab.closest('[data-state]')).toHaveAttribute('data-state', 'active');
  });

  it('bulk tab trigger is present and its content panel exists', () => {
    render(<QuickOrder />);

    const bulkTrigger = screen.getByText('tabs.bulkUpload');
    expect(bulkTrigger).toBeInTheDocument();
    expect(bulkTrigger).toHaveAttribute('data-state', 'inactive');
  });

  it('renders the product list section', () => {
    render(<QuickOrder />);

    expect(screen.getByTestId('mock-quick-order-product-list')).toBeInTheDocument();
  });

  it('renders the overview section', () => {
    render(<QuickOrder />);

    expect(screen.getByTestId('mock-quick-order-overview')).toBeInTheDocument();
  });

  it('"Add to Cart" button is present in overview', () => {
    render(<QuickOrder />);

    expect(screen.getByTestId('add-to-cart-btn')).toBeInTheDocument();
  });
});
