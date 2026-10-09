/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddressListRenderer } from './AddressListRenderer';
import { CartSummaryRenderer } from './CartSummaryRenderer';
import { CheckoutConfirmRenderer } from './CheckoutConfirmRenderer';
import { OrderSummaryRenderer } from './OrderSummaryRenderer';
import { ProductListRenderer } from './ProductListRenderer';
import { ProductSelection } from './ProductSelection';
import { QuoteListRenderer } from './QuoteListRenderer';
import { ReturnListRenderer } from './ReturnListRenderer';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

const mockUseCheckoutAddressBook = jest.fn();
jest.mock('@/hooks/checkout/useCheckoutAddressBook', () => ({
  useCheckoutAddressBook: (addressType?: string) => mockUseCheckoutAddressBook(addressType),
}));

const mockSetShippingAddress = jest.fn();
const mockSetBillingAddress = jest.fn();
jest.mock('@/providers/StoreProvider', () => ({
  useCheckoutStore: () => ({ setShippingAddress: mockSetShippingAddress, setBillingAddress: mockSetBillingAddress }),
}));

const mockUseCheckout = jest.fn();
jest.mock('@/hooks/checkout/useCheckout', () => ({
  useCheckout: () => mockUseCheckout(),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => ({ paymentModes: [{ id: 'pm-invoice', code: 'invoice', active: true }] }),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const item = { productId: 'p-1', name: 'Coolant 5L', quantity: 2, unitPrice: { net: 10, currency: 'EUR' } };

const companyHq = {
  id: '68622732f0a94121484b3906',
  contactName: 'World Company HQ — OFFICE',
  companyName: 'World Company',
  street: 'Hauptstrasse 10',
  zipCode: '10501',
  city: 'Berlin',
  country: 'DE',
  tags: ['BILLING', 'SHIPPING'],
  source: 'legalEntity',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseCheckoutAddressBook.mockReturnValue({ loading: false, addresses: [] });
});

describe('AI chat widgets', () => {
  it('renders the order summary as one framed widget with a details link', () => {
    const { container } = render(
      <OrderSummaryRenderer
        data={{
          orderId: 'O-1',
          status: 'COMPLETED',
          date: '2026-01-01',
          total: { gross: 23.8, net: 20 },
          items: [item],
        }}
      />,
    );
    expect(screen.getByText('#O-1')).toBeInTheDocument();
    expect(screen.getByTestId('aiOrderSummary-viewDetails')).toHaveAttribute(
      'href',
      expect.stringContaining('/account/orders/O-1'),
    );
    expect(screen.getByTestId('aiOrderSummary-O-1-product-p-1')).toBeInTheDocument();
    expect(container.querySelectorAll('.rounded-xl')).toHaveLength(0);
  });

  it('adds the chosen quantity to the cart from a product row', () => {
    const onAddToCart = jest.fn();
    render(
      <ProductListRenderer
        data={{ products: [{ productId: 'p-1', name: 'Coolant 5L', price: 10, currency: 'EUR' }] }}
        onAddToCart={onAddToCart}
      />,
    );
    fireEvent.click(screen.getByTestId('aiProducts-p-1-increase'));
    fireEvent.click(screen.getByTestId('aiProducts-p-1-addToCart'));
    expect(onAddToCart).toHaveBeenCalledWith('p-1', 2);
  });

  it('submits selected variants with their quantities', () => {
    const setQuestionValue = jest.fn();
    render(
      <ProductSelection
        data={{ variantGroups: [{ message: 'Size', items: [{ itemId: 'v-1', name: '5L', price: 10 }] }] }}
        setQuestionValue={setQuestionValue}
        handleQuestionSubmit={jest.fn()}
      />,
    );
    const submit = screen.getByTestId('aiProductSelection-addSelectedToCart');
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByTestId('aiProductSelection-v-1-checkbox'));
    fireEvent.click(submit);
    expect(setQuestionValue).toHaveBeenCalledTimes(1);
  });

  it('renders quote and return lists as table rows', () => {
    render(
      <>
        <QuoteListRenderer data={{ quotes: [{ quoteId: 'Q-1', status: 'OPEN', submittedDate: '2026-01-01' }] }} />
        <ReturnListRenderer data={{ returns: [{ id: 'R-1', approvalStatus: 'PENDING', orders: [{ id: 'O-1' }] }] }} />
      </>,
    );
    expect(screen.getByTestId('aiQuotes-row-Q-1')).toBeInTheDocument();
    expect(screen.getByTestId('aiReturns-row-R-1')).toBeInTheDocument();
  });

  it('sends the picked address back to the agent during checkout', () => {
    const setQuestionValue = jest.fn();
    render(
      <AddressListRenderer
        data={{
          addresses: [
            { id: 'A1', name: 'HQ', addressLine1: 'Main St 1', postalCode: '10115', city: 'Berlin', country: 'DE' },
          ],
        }}
        handlers={{ setQuestionValue, handleQuestionSubmit: jest.fn() }}
      />,
    );
    fireEvent.click(screen.getByTestId('aiAddresses-select-A1'));
    expect(setQuestionValue).toHaveBeenCalledWith('message');
  });

  it('offers the storefront checkout address book for the requested role when the agent sent none', () => {
    mockUseCheckoutAddressBook.mockReturnValue({
      loading: false,
      addresses: [
        {
          id: 'loc-1',
          contactName: 'World Company HQ',
          companyName: 'World Company',
          street: 'Dock Rd',
          zipCode: '20457',
          city: 'Hamburg',
          country: 'DE',
          tags: ['SHIPPING'],
        },
      ],
    });
    const setQuestionValue = jest.fn();
    render(
      <AddressListRenderer
        data={{ loadFromAccount: true, addressType: 'SHIPPING' }}
        handlers={{ setQuestionValue, handleQuestionSubmit: jest.fn() }}
      />,
    );
    expect(mockUseCheckoutAddressBook).toHaveBeenCalledWith('SHIPPING');
    expect(screen.getByText('Dock Rd')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('aiAddresses-select-loc-1'));
    expect(setQuestionValue).toHaveBeenCalledWith('message');
  });

  it('hands the full company address to the storefront checkout for the step named in the caption', () => {
    mockUseCheckoutAddressBook.mockReturnValue({ loading: false, addresses: [companyHq] });
    render(
      <AddressListRenderer
        data={{ addresses: [{ id: companyHq.id, name: 'World Company HQ', city: 'Berlin' }] }}
        caption="Please select your billing address."
        handlers={{ setQuestionValue: jest.fn(), handleQuestionSubmit: jest.fn() }}
      />,
    );
    fireEvent.click(screen.getByTestId(`aiAddresses-select-${companyHq.id}`));
    expect(mockSetBillingAddress).toHaveBeenCalledWith({ ...companyHq, type: 'BILLING' });
    expect(mockSetShippingAddress).not.toHaveBeenCalled();
  });

  it('places the order through the storefront checkout and links to it', async () => {
    const processCheckout = jest.fn().mockResolvedValue({ orderId: 'EON9000' });
    mockUseCheckout.mockReturnValue({
      checkoutCart: { id: 'cart-1' },
      shippingAddress: { ...companyHq, type: 'SHIPPING' },
      billingAddress: { ...companyHq, type: 'BILLING' },
      availableShippingMethods: [
        { id: 'de-express-dhl', name: 'DHL Express', zoneId: 'z', cost: { amount: 9.95, currency: 'EUR' } },
      ],
      shippingMethodsLoading: false,
      shippingMethod: { methodId: 'de-express-dhl', zoneId: 'z', methodName: 'DHL Express', amount: 9.95 },
      submitShippingMethod: jest.fn(),
      paymentMethod: { id: 'pm-invoice', code: 'invoice', active: true, provider: 'none' },
      submitPaymentMethod: jest.fn(),
      processCheckout,
      loading: false,
      error: null,
    });
    render(<CheckoutConfirmRenderer />);
    expect(screen.getByTestId('aiCheckout-shippingMethod-de-express-dhl')).toBeInTheDocument();
    expect(screen.getByTestId('aiCheckout-paymentMethod-invoice')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('aiCheckout-placeOrder'));
    expect(processCheckout).toHaveBeenCalled();
    expect(await screen.findByTestId('aiCheckout-viewOrder')).toHaveAttribute('href', '/account/orders/EON9000');
  });

  it('keeps the go-to-cart selector', () => {
    render(<CartSummaryRenderer data={{ items: [item], total: { gross: 23.8, net: 20, tax: 3.8 } }} />);
    expect(screen.getByTestId('aiHelper-goToCart')).toHaveAttribute('href', '/cart');
    expect(screen.getByTestId('aiCart-product-p-1')).toBeInTheDocument();
  });
});
