/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import { AddressCard } from './address-card';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/customer/useAddresses', () => ({
  useAddresses: () => ({
    addresses: [],
    loading: false,
    error: null,
    fetchAddresses: jest.fn(),
    deleteAddress: jest.fn(),
  }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('./address-dialog', () => ({
  AddressDialog: () => null,
}));

const billingAddress: CustomerAddress = {
  id: 'billing-1',
  contactName: 'p.bambynek+regtest@emporix.com',
  companyName: 'Emporix GmbH',
  street: 'billingadd',
  streetNumber: '24',
  zipCode: '24-666',
  city: 'Berlin',
  country: 'DE',
  tags: ['BILLING'],
  source: 'customer',
  isDefault: true,
};

describe('AddressCard', () => {
  it('keeps the location icon and default badge on billing cards', () => {
    render(<AddressCard address={billingAddress} onEdit={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getAllByText('p.bambynek+regtest@emporix.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Address.default')).toBeInTheDocument();
    expect(document.querySelector('.lucide-map-pin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Address.editAddress' })).toBeInTheDocument();
  });

  it('contains long contact names inside the card', () => {
    render(<AddressCard address={billingAddress} onEdit={jest.fn()} onDelete={jest.fn()} />);

    const title = screen.getAllByText(billingAddress.contactName as string)[0];
    expect(title).toHaveClass('truncate');
    expect(title.parentElement).toHaveClass('min-w-0');
  });
});
