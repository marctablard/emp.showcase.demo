/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import { AddressSelector } from './address-selector';

const swissOffice: CustomerAddress = {
  id: 'loc-ch',
  contactName: 'Swiss Office',
  companyName: 'Emporix GmbH',
  street: 'Some streetLine',
  streetNumber: '2',
  zipCode: '63000',
  city: 'Zug',
  country: 'CH',
  tags: ['SHIPPING', 'BILLING'],
  source: 'legalEntity',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}));

jest.mock('@/hooks/customer/useAddresses', () => ({
  useAddresses: () => ({
    addresses: [swissOffice],
    loading: false,
  }),
}));

jest.mock('@/hooks/customer/useLegalEntityCheckoutAddresses', () => ({
  useLegalEntityCheckoutAddresses: () => ({
    addresses: [],
    loading: false,
  }),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  __esModule: true,
  default: () => ({ customer: { businessModel: 'B2C' } }),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({ session: {} }),
}));

describe('AddressSelector', () => {
  it('selects a row, notifies the parent, and closes only the address-book dialog', () => {
    const onSelect = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <AddressSelector
        addressBook="customer"
        addressType="SHIPPING"
        onSelect={onSelect}
        onOpenChange={onOpenChange}
        triggerElement={<button type="button">fromAddressbook</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'fromAddressbook' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Swiss Office')).toBeInTheDocument();
    expect(screen.getByTestId('addressSelector-list')).toBeInTheDocument();
    expect(screen.getByTestId('addressSelector-item-loc-ch')).toHaveAttribute('data-country', 'CH');
    expect(screen.getByTestId('addressSelector-item-loc-ch-tag-shipping')).toBeInTheDocument();
    expect(screen.getByTestId('addressSelector-item-loc-ch-tag-billing')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('addressSelector-item-loc-ch'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'loc-ch', country: 'CH', zipCode: '63000' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Swiss Office')).not.toBeInTheDocument();
  });

  it('prefixes address-book row test ids when testIdPrefix is set', () => {
    render(
      <AddressSelector
        addressBook="customer"
        addressType="SHIPPING"
        testIdPrefix="shipping"
        onSelect={jest.fn()}
        triggerElement={<button type="button">fromAddressbook</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'fromAddressbook' }));
    expect(screen.getByTestId('shipping-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-list')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-item-loc-ch')).toHaveAttribute('data-country', 'CH');
    expect(screen.getByTestId('shipping-item-loc-ch-tag-shipping')).toBeInTheDocument();
  });
});
