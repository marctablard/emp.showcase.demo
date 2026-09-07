/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('CartRequest', () => {
  beforeEach(() => {
    useAuthenticationMock.mockReturnValue({ isAuthenticated: true });
  });

  it('renders the request quote CTA in request mode', () => {
    const onRequestQuote = jest.fn();
    render(<CartRequest onRequestQuote={onRequestQuote} />);

    expect(screen.getByText('requestQuote')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'requestQuoteButton' }));
    expect(onRequestQuote).toHaveBeenCalledTimes(1);
  });

  it('keeps the request CTA copy for unauthenticated users', () => {
    useAuthenticationMock.mockReturnValue({ isAuthenticated: false });

    render(<CartRequest onRequestQuote={jest.fn()} />);

    expect(screen.getByText('requestQuote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'requestQuoteButton' })).toBeDisabled();
  });
});
