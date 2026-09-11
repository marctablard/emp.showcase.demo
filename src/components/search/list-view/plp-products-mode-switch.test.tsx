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

jest.mock('@/hooks/site/useSiteCode', () => ({
  useSiteCode: () => 'main',
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

  it('renders Assigned Products selected and All Products visible in assigned mode', () => {
    renderSwitch(segmented('assigned'));

    const group = screen.getByTestId('plp-productsModeSwitch');
    const assigned = screen.getByTestId('plp-productsModeAssigned');
    const all = screen.getByTestId('plp-productsModeAll');

    expect(group).toHaveAttribute('role', 'radiogroup');
    expect(group).toHaveAttribute('aria-label', 'productsModeSwitchLabel');
    expect(assigned).toBeChecked();
    expect(assigned).not.toBeDisabled();
    expect(all).not.toBeChecked();
    expect(screen.getByTestId('plp-productsModeLabel')).toHaveTextContent('assignedProductsShort');
    expect(screen.getByRole('radio', { name: 'allProductsShort' })).toBe(all);
  });

  it('renders All Products selected in all mode', () => {
    renderSwitch(segmented('all'));

    expect(screen.getByTestId('plp-productsModeAll')).toBeChecked();
    expect(screen.getByTestId('plp-productsModeAssigned')).not.toBeChecked();
    expect(screen.getByTestId('plp-productsModeLabel')).toHaveTextContent('allProductsShort');
    expect(screen.getByRole('radio', { name: 'assignedProductsShort' })).toBeInTheDocument();
  });

  it('applies the optional className to the radiogroup', () => {
    renderSwitch(segmented('assigned'), 'mb-4');

    expect(screen.getByTestId('plp-productsModeSwitch')).toHaveClass('mb-4', 'inline-flex', 'rounded-full');
  });

  it('calls setProductsMode("all") then refreshes the router when All Products is chosen', async () => {
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeAll'));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockSetProductsMode).toHaveBeenCalledTimes(1);
    expect(mockSetProductsMode).toHaveBeenCalledWith('all', 'main');
    expect(mockSetProductsMode.mock.invocationCallOrder[0]).toBeLessThan(mockRefresh.mock.invocationCallOrder[0]);
    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(screen.getByTestId('plp-productsModeAll')).not.toBeDisabled();
  });

  it('calls setProductsMode("assigned") when Assigned Products is chosen', async () => {
    mockSetProductsMode.mockResolvedValue({ ok: true, mode: 'assigned' });
    renderSwitch(segmented('all'));

    fireEvent.click(screen.getByTestId('plp-productsModeAssigned'));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockSetProductsMode).toHaveBeenCalledWith('assigned', 'main');
  });

  it('does not call setProductsMode when the already-selected option is clicked', async () => {
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeAssigned'));

    expect(mockSetProductsMode).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('logs and re-enables without refreshing when the update is rejected', async () => {
    mockSetProductsMode.mockResolvedValue({ ok: false });
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeAll'));

    await waitFor(() => expect(mockLoggerError).toHaveBeenCalledTimes(1));
    expect(mockLoggerError).toHaveBeenCalledWith({ mode: 'all' }, 'Products mode toggle rejected');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('plp-productsModeAll')).not.toBeDisabled();
  });

  it('logs the error without refreshing when the update throws', async () => {
    const err = new Error('network');
    mockSetProductsMode.mockRejectedValue(err);
    renderSwitch(segmented('assigned'));

    fireEvent.click(screen.getByTestId('plp-productsModeAll'));

    await waitFor(() => expect(mockLoggerError).toHaveBeenCalledTimes(1));
    expect(mockLoggerError).toHaveBeenCalledWith({ err, mode: 'all' }, 'Products mode toggle failed');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('plp-productsModeAll')).not.toBeDisabled();
  });
});
