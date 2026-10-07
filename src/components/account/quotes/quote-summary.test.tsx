/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import deAccountTranslations from '@/i18n/translations/de/account/index.json';
import enAccountTranslations from '@/i18n/translations/en/account/index.json';
import type { Quote } from '@/platform/services/model/quote';
import { QuoteSummary } from './quote-summary';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'de-DE',
}));

const baseQuote: Quote = {
  id: 'Q-1000',
  status: 'OPEN',
  reference: 'Quote Ref',
  submittedDate: '2026-05-31T10:00:00.000Z',
  customerId: 'customer-1',
  customerName: 'Ada Lovelace',
  currency: 'EUR',
  totalGross: 119,
  totalNet: 100,
  totalVat: 19,
  vatRate: 19,
  items: [
    {
      product: {
        id: 'p1',
        quantity: 1,
        itemPrice: {
          amount: 119,
          currency: 'EUR',
          taxRate: 19,
          netValue: 100,
          tax: 19,
        },
      },
      quantity: { quantity: 1, unitCode: 'pc' },
    },
  ],
  shippingAddress: {
    type: 'SHIPPING',
    contactName: 'Ada Lovelace',
    street: 'Main Street 1',
    zipCode: '10115',
    city: 'Berlin',
    country: 'Germany',
  },
  shippingCost: 5,
  shippingMethod: 'DHL Standard',
};

describe('QuoteSummary', () => {
  it('uses Shipping method / Shipping address label copy (EN/DE)', () => {
    expect(enAccountTranslations.quoteDetails.shippingMethod).toBe('Shipping method');
    expect(enAccountTranslations.quoteDetails.shippingAddress).toBe('Shipping address');
    expect(deAccountTranslations.quoteDetails.shippingMethod).toBe('Versandart');
    expect(deAccountTranslations.quoteDetails.shippingAddress).toBe('Versandadresse');
  });

  it('shows VAT rate from item taxRate when present', () => {
    render(<QuoteSummary quote={{ ...baseQuote, vatRate: undefined, totalNet: 0, totalVat: 36.09 }} />);

    expect(screen.getAllByText('tax (19%)').length).toBeGreaterThanOrEqual(1);
  });

  it('shows VAT without a percent when items omit taxRate', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          vatRate: undefined,
          items: [
            {
              product: {
                id: 'p1',
                quantity: 1,
                itemPrice: { amount: 119, currency: 'EUR', netValue: 100, tax: 19 },
              },
              quantity: { quantity: 1, unitCode: 'pc' },
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('tax').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/tax \(/)).not.toBeInTheDocument();
  });

  it('shows VAT rate percent when totalNet > 0 and formats amounts with locale currency symbols', () => {
    render(<QuoteSummary quote={baseQuote} />);

    expect(screen.getAllByText('tax (19%)').length).toBeGreaterThanOrEqual(1);
    // de-DE EUR → "100,00 €" (narrow/no-break space variants allowed)
    expect(screen.getAllByText(/100,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/19,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5,00\s*€/).length).toBeGreaterThanOrEqual(1);
  });

  it('still shows goods VAT percent when taxAggregate mixes goods and shipping rates', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          vatRate: undefined,
          shippingCost: 20,
          shippingGross: 20.74,
          shippingTaxRate: 3.7,
          taxAggregate: {
            lines: [
              { name: 'STANDARD', amount: 7.7, rate: 7.7, taxable: 100 },
              { name: 'REDUCED_3', amount: 0.74, rate: 3.7, taxable: 20 },
            ],
          },
          items: [
            {
              product: {
                id: 'p1',
                quantity: 2,
                itemPrice: { amount: 107.7, currency: 'CHF', taxRate: 7.7, netValue: 100, tax: 7.7 },
              },
              quantity: { quantity: 2, unitCode: 'pc' },
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('tax (7.7%)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('shippingVat (3.7%)').length).toBeGreaterThanOrEqual(2);
  });

  it('omits goods VAT percent when item tax rates differ, but still shows shipping VAT percent', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          vatRate: undefined,
          shippingCost: 20,
          shippingGross: 20.74,
          shippingTaxRate: 3.7,
          items: [
            {
              product: {
                id: 'p1',
                quantity: 1,
                itemPrice: { amount: 107.7, currency: 'CHF', taxRate: 7.7, netValue: 100, tax: 7.7 },
              },
              quantity: { quantity: 1, unitCode: 'pc' },
            },
            {
              product: {
                id: 'p2',
                quantity: 1,
                itemPrice: { amount: 119, currency: 'CHF', taxRate: 19, netValue: 100, tax: 19 },
              },
              quantity: { quantity: 1, unitCode: 'pc' },
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('tax').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/tax \(\d/)).not.toBeInTheDocument();
    expect(screen.getAllByText('shippingVat (3.7%)').length).toBeGreaterThanOrEqual(2);
  });

  it('omits the tax row when totalVat is 0 and vatRate is absent', () => {
    render(<QuoteSummary quote={{ ...baseQuote, totalNet: 0, totalVat: 0, vatRate: undefined }} />);

    expect(screen.queryByText(/tax/)).not.toBeInTheDocument();
  });

  it('omits the tax row when vatRate is 0%', () => {
    render(<QuoteSummary quote={{ ...baseQuote, vatRate: 0, totalVat: 0 }} />);

    expect(screen.queryByText(/tax/)).not.toBeInTheDocument();
  });

  it('shows Free for shipping fee when shippingCost is 0 on Base and Quoted price cards', () => {
    render(<QuoteSummary quote={{ ...baseQuote, shippingCost: 0 }} />);

    expect(screen.getAllByText('free').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByText(/5,00\s*€/)).toHaveLength(0);
  });

  it('renders Quoted Price shipping tax when shipping.value > 0 and hides it when shipping is free', () => {
    const { rerender } = render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          subtotalNet: 100,
          subtotalVat: 19,
          shippingCost: 5,
          shippingGross: 5.95,
          totalGross: 124.95,
        }}
      />,
    );

    // Base + Quoted both show shipping tax when shipping is paid
    expect(screen.getAllByText(/shippingVat/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/0,95\s*€/).length).toBeGreaterThanOrEqual(2);

    rerender(
      <QuoteSummary
        quote={{
          ...baseQuote,
          subtotalNet: 100,
          subtotalVat: 19,
          shippingCost: 0,
          shippingGross: 0,
          totalGross: 119,
        }}
      />,
    );

    expect(screen.queryByText(/shippingVat/)).not.toBeInTheDocument();
  });

  it('renders Base Price from unitPrice and Quoted Price from API totals', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          totalNet: 1194.79,
          totalVat: 227.01,
          shippingCost: 11,
          items: [
            {
              product: {
                id: 'p1',
                quantity: 1,
                itemPrice: {
                  amount: 100.56,
                  currency: 'EUR',
                  unitPrice: 130,
                  newUnitPrice: 84.5,
                  discount: 35,
                  taxRate: 19,
                  netValue: 84.5,
                },
              },
              quantity: { quantity: 1, unitCode: 'pc' },
            },
            {
              product: {
                id: 'p2',
                quantity: 1,
                itemPrice: {
                  amount: 1321.25,
                  currency: 'EUR',
                  unitPrice: 1850.49,
                  newUnitPrice: 1110.29,
                  discount: 40,
                  taxRate: 19,
                  netValue: 1110.29,
                },
              },
              quantity: { quantity: 1, unitCode: 'pc' },
            },
          ],
        }}
      />,
    );

    // Base net = 130 + 1850.49
    expect(screen.getByText(/1\.980,49\s*€/)).toBeInTheDocument();
    // Quoted net
    expect(screen.getByText(/1\.194,79\s*€/)).toBeInTheDocument();
    // Discount savings row on Base card
    expect(screen.getByText('discount')).toBeInTheDocument();
  });

  it('uses Netto-Warenwert for the German Quote netValue label', () => {
    expect(enAccountTranslations.quoteDetails.netValue).toBe('Net value of goods');
    expect(deAccountTranslations.quoteDetails.netValue).toBe('Netto-Warenwert');
  });

  it('uses Total net amount label copy in EN/DE quoteDetails', () => {
    expect(enAccountTranslations.quoteDetails.totalAmount).toBe('Total net amount');
    expect(deAccountTranslations.quoteDetails.totalAmount).toBe('Nettogesamtwert');
  });

  it('uses Base Net Unit Price / Discount label copy in EN/DE quoteDetails', () => {
    expect(enAccountTranslations.quoteDetails.baseNetUnitPrice).toBe('Base Net Unit Price');
    expect(enAccountTranslations.quoteDetails.discount).toBe('Discount');
    expect(deAccountTranslations.quoteDetails.baseNetUnitPrice).toBe('Basis-Nettostückpreis');
    expect(deAccountTranslations.quoteDetails.discount).toBe('Rabatt');
  });

  it('uses Free label copy in EN/DE quoteDetails', () => {
    expect(enAccountTranslations.quoteDetails.free).toBe('Free');
    expect(deAccountTranslations.quoteDetails.free).toBe('Kostenlos');
  });

  it('renders shipping method name with Shipping method / Shipping address labels', () => {
    render(<QuoteSummary quote={baseQuote} />);

    expect(screen.getByText('shippingMethod').closest('td')?.nextElementSibling).toHaveTextContent('DHL Standard');
    expect(screen.getByText('shippingAddress')).toBeInTheDocument();
    expect(screen.queryByText('transportCondition')).not.toBeInTheDocument();
    expect(screen.queryByText('deliveryAddress')).not.toBeInTheDocument();
  });

  it('renders shipping methodId when methodName is absent but methodId is present', () => {
    render(<QuoteSummary quote={{ ...baseQuote, shippingMethod: 'pickup' }} />);

    expect(screen.getByText('pickup')).toBeInTheDocument();
  });

  it('shows a dash when shipping method is missing', () => {
    render(<QuoteSummary quote={{ ...baseQuote, shippingMethod: '' }} />);

    expect(screen.getByText('shippingMethod').closest('td')?.nextElementSibling).toHaveTextContent(/^-$/);
  });

  it('links the related approval only once its href is resolved', () => {
    const { rerender } = render(<QuoteSummary quote={baseQuote} relatedApprovalId="approval-1" />);

    expect(screen.getByTestId('quote-relatedApproval')).toHaveTextContent('#approval-1');
    expect(screen.queryByRole('link', { name: '#approval-1' })).not.toBeInTheDocument();

    rerender(
      <QuoteSummary
        quote={baseQuote}
        relatedApprovalId="approval-1"
        relatedApprovalHref="/account/approvals/approval-1"
      />,
    );

    expect(screen.getByRole('link', { name: '#approval-1' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/account\/approvals\/approval-1$/),
    );
  });

  it('formats shipping address with line breaks and omits missing parts', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          shippingAddress: {
            type: 'SHIPPING',
            contactName: 'Vitalii Buyer',
            street: 'Hauptstraße 123',
            zipCode: '10115',
            city: 'Berlin',
            country: 'Deutschland',
          },
        }}
      />,
    );

    const addressField = screen.getByText('shippingAddress').parentElement;
    expect(addressField).toHaveTextContent('Vitalii Buyer');
    expect(addressField).toHaveTextContent('Hauptstraße 123');
    expect(addressField).toHaveTextContent('10115 Berlin');
    expect(addressField).toHaveTextContent('Deutschland');
    expect(addressField).not.toHaveTextContent('undefined');
    expect(addressField?.innerHTML).toContain('<br');
  });

  it('omits empty address parts and never renders literal undefined', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          shippingAddress: {
            type: 'SHIPPING',
            contactName: 'Vitalii Buyer',
            // Simulate pre-fix mapper concat pollution and missing city
            street: 'Hauptstraße 123 undefined',
            zipCode: '10115',
            city: '',
            country: 'Deutschland',
          },
        }}
      />,
    );

    const addressField = screen.getByText('shippingAddress').parentElement;
    expect(addressField).toHaveTextContent('Vitalii Buyer');
    expect(addressField).toHaveTextContent('Hauptstraße 123');
    expect(addressField).toHaveTextContent('10115');
    expect(addressField).toHaveTextContent('Deutschland');
    expect(addressField).not.toHaveTextContent('Berlin');
    expect(addressField?.textContent).not.toMatch(/undefined/);
  });

  it('drops a streetNumber that is exactly the literal undefined string', () => {
    render(
      <QuoteSummary
        quote={{
          ...baseQuote,
          shippingAddress: {
            type: 'SHIPPING',
            contactName: 'Vitalii Buyer',
            street: 'Hauptstraße 123',
            streetNumber: 'undefined',
            zipCode: '10115',
            city: 'Berlin',
            country: 'Deutschland',
          },
        }}
      />,
    );

    const addressField = screen.getByText('shippingAddress').parentElement;
    expect(addressField).toHaveTextContent('Hauptstraße 123');
    expect(addressField).toHaveTextContent('10115 Berlin');
    expect(addressField?.textContent).not.toMatch(/\bundefined\b/);
  });
});
