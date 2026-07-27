/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { CartRequest } from './cart-request';

const useAuthenticationMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/authentication/useAuthentication', () => ({
  __esModule: true,
  default: () => useAuthenticationMock(),
}));

jest.mock('../ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CollapsibleContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('./quote-request-dialog', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => <div data-testid="quote-request-dialog">{String(open)}</div>,
}));

describe('CartRequest', () => {
  beforeEach(() => {
    useAuthenticationMock.mockReturnValue({ isAuthenticated: true });
  });

  it('renders the request quote CTA in request mode', () => {
    render(<CartRequest />);

    expect(screen.getByText('requestQuote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'requestQuoteButton' })).toBeInTheDocument();
    expect(screen.getByTestId('quote-request-dialog')).toHaveTextContent('false');
  });

  it('keeps the request CTA copy for unauthenticated users', () => {
    useAuthenticationMock.mockReturnValue({ isAuthenticated: false });

    render(<CartRequest />);

    expect(screen.getByText('requestQuote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'requestQuoteButton' })).toBeDisabled();
    expect(screen.getByTestId('quote-request-dialog')).toHaveTextContent('false');
  });
});
