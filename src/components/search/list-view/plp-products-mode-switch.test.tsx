/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ProductsModeContextValue, ProductsModeProvider } from '@/components/navigation/products-mode-context';
import { PlpProductsModeSwitch } from './plp-products-mode-switch';

const mockRefresh = jest.fn();
const mockSetProductsMode = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/client/customer-segment', () => ({
  setProductsMode: (...args: unknown[]) => mockSetProductsMode(...args),
}));

jest.mock('@/hooks/common/useLogger', () => ({
  useLogger: () => ({
    error: mockLoggerError,
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

const segmented = (mode: ProductsModeContextValue['mode']): ProductsModeContextValue => ({
  mode,
  isSegmented: true,
  canToggleAllProducts: true,
});

const renderSwitch = (value: ProductsModeContextValue, className?: string) =>
  render(
    <ProductsModeProvider value={value}>
      <PlpProductsModeSwitch className={className} />
    </ProductsModeProvider>,
  );

describe('PlpProductsModeSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetProductsMode.mockResolvedValue({ ok: true, mode: 'all' });
  });

  it('renders nothing when the toggle is not available', () => {
    renderSwitch({ mode: 'assigned', isSegmented: true, canToggleAllProducts: false });

    expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('plp-productsModeLabel')).not.toBeInTheDocument();
  });

  it('renders nothing for anonymous customers (outside a provider)', () => {
    render(<PlpProductsModeSwitch />);

    expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
  });

  it('renders an unchecked switch labelled "Assigned Products" in assigned mode', () => {
    renderSwitch(segmented('assigned'));

    const control = screen.getByTestId('plp-productsModeSwitch');

    expect(control).toHaveAttribute('role', 'switch');
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(control).toHaveAttribute('aria-label', 'productsModeSwitchLabel');
    expect(control).not.toBeDisabled();
    expect(screen.getByTestId('plp-productsModeLabel')).toHaveTextContent('assignedProducts');
    expect(screen.getByTestId('plp-productsModeLabel')).not.toHaveTextContent('allProducts');
    expect(screen.getByLabelText('assignedProducts')).toBe(control);
  });

  it('renders a checked switch labelled "All Products" in all mode', () => {
    renderSwitch(segmented('all'));

    const control = screen.getByTestId('plp-productsModeSwitch');

    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('plp-productsModeLabel')).toHaveTextContent('allProducts');
    expect(screen.getByTestId('plp-productsModeLabel')).not.toHaveTextContent('assignedProducts');
    expect(screen.getByLabelText('allProducts')).toBe(control);
  });

  it('applies the optional className to the wrapper', () => {
    renderSwitch(segmented('assigned'), 'mb-4');

    expect(screen.getByTestId('plp-productsModeSwitch').parentElement).toHaveClass('mb-4', 'flex', 'items-center');
  });

  it('calls setProductsMode("all") then refreshes the router when switched on', async () => {
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeSwitch'));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockSetProductsMode).toHaveBeenCalledTimes(1);
    expect(mockSetProductsMode).toHaveBeenCalledWith('all');
    expect(mockSetProductsMode.mock.invocationCallOrder[0]).toBeLessThan(mockRefresh.mock.invocationCallOrder[0]);
    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(screen.getByTestId('plp-productsModeSwitch')).not.toBeDisabled();
  });

  it('calls setProductsMode("assigned") when switched off', async () => {
    mockSetProductsMode.mockResolvedValue({ ok: true, mode: 'assigned' });
    renderSwitch(segmented('all'));

    fireEvent.click(screen.getByTestId('plp-productsModeSwitch'));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockSetProductsMode).toHaveBeenCalledWith('assigned');
  });

  it('logs and re-enables without refreshing when the update is rejected', async () => {
    mockSetProductsMode.mockResolvedValue({ ok: false });
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeSwitch'));

    await waitFor(() => expect(mockLoggerError).toHaveBeenCalledTimes(1));
    expect(mockLoggerError).toHaveBeenCalledWith({ mode: 'all' }, 'Products mode toggle rejected');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('plp-productsModeSwitch')).not.toBeDisabled();
  });

  it('logs the error without refreshing when the update throws', async () => {
    const err = new Error('network');
    mockSetProductsMode.mockRejectedValue(err);
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeSwitch'));

    await waitFor(() => expect(mockLoggerError).toHaveBeenCalledTimes(1));
    expect(mockLoggerError).toHaveBeenCalledWith({ err, mode: 'all' }, 'Products mode toggle failed');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('plp-productsModeSwitch')).not.toBeDisabled();
  });
});
