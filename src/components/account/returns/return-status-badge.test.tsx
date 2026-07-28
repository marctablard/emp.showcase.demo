/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ReturnStatusBadge } from './return-status-badge';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ReturnStatusBadge', () => {
  it('renders the EXPIRED badge with the muted terminal/inactive variant, not the mint secondary override', () => {
    render(<ReturnStatusBadge status="PENDING" isExpired />);

    const badge = screen.getByText('EXPIRED');
    expect(badge).toHaveClass('bg-surface-disabled');
    expect(badge).toHaveClass('border-border-primary');
    expect(badge).not.toHaveClass('bg-surface-secondary');
  });

  it('renders the non-expired status badge using the status variant mapping', () => {
    render(<ReturnStatusBadge status="PENDING" isExpired={false} />);

    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });
});
