/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { CartItem, CartItemSubstitution } from '@/platform/services/model/cart/cart.d';
import { SubstitutionModal } from './substitution-modal';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key} ${JSON.stringify(values)}` : `${namespace}.${key}`,
  useLocale: () => 'en',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({ l10n: (value: unknown) => (typeof value === 'string' ? value : '-') }),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({ updateItemQuantity: jest.fn(), addItem: jest.fn(), loading: false }),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({ session: { siteCode: 'main', currency: 'EUR' } }),
}));

jest.mock('@/hooks/common/useClientFetchScope', () => ({
  useClientFetchScope: () => 'test-scope',
}));

const mockUseAvailability = jest.fn();
jest.mock('@/hooks/product/useAvailability', () => ({
  useAvailability: (...args: unknown[]) => mockUseAvailability(...args),
}));

jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/client/prices', () => ({
  fetchProductPrice: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/components/cart/service-cockpit-ticket-dialog', () => ({
  ServiceCockpitTicketDialog: () => null,
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const cartItem = {
  id: 'item-1',
  quantity: 50,
  product: { id: 'product-1', name: 'Inverter', images: [] },
} as unknown as CartItem;

const substitution = { substitutions: [] } as unknown as CartItemSubstitution;

function renderModal() {
  return render(
    <SubstitutionModal isOpen onClose={jest.fn()} cartItem={cartItem} substitution={substitution} onDone={jest.fn()} />,
  );
}

describe('SubstitutionModal replenishment time', () => {
  beforeEach(() => {
    mockUseAvailability.mockReset();
  });

  it('shows a 28-day replenishment time next to the stock availability', () => {
    mockUseAvailability.mockReturnValue({
      availability: { productId: 'product-1', availableQuantity: 40, availableInDays: null, isAvailable: true },
    });

    renderModal();

    const badge = screen.getByTestId('substitution-replenishmentTime');
    expect(within(badge).getByText('cart.substitution.replenishmentTime {"days":28}')).toBeInTheDocument();
    const stock = screen.getByText('cart.substitution.availableDescription {"available":40,"total":50}');
    expect(stock.parentElement?.parentElement).toBe(badge.parentElement);
  });

  it('shows the replenishment time even before availability has loaded', () => {
    mockUseAvailability.mockReturnValue({ availability: undefined });

    renderModal();

    expect(screen.getByTestId('substitution-replenishmentTime')).toHaveTextContent(
      'cart.substitution.replenishmentTime {"days":28}',
    );
  });
});
