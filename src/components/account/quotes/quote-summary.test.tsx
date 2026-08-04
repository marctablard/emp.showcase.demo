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
  items: [],
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

  it('shows VAT rate from taxAggregate (vatRate) when present', () => {
    render(<QuoteSummary quote={{ ...baseQuote, vatRate: 19, totalNet: 0, totalVat: 36.09 }} />);

    expect(screen.getAllByText('vat (19%)').length).toBeGreaterThanOrEqual(1);
  });

  it('shows VAT rate percent when totalNet > 0 and formats amounts with locale currency symbols', () => {
    render(<QuoteSummary quote={baseQuote} />);

    expect(screen.getAllByText('vat (19%)').length).toBeGreaterThanOrEqual(1);
    // de-DE EUR → "100,00 €" (narrow/no-break space variants allowed)
    expect(screen.getAllByText(/100,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/19,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5,00\s*€/).length).toBeGreaterThanOrEqual(1);
  });

  it('omits VAT rate percent when totalNet is not positive and vatRate is absent', () => {
    render(<QuoteSummary quote={{ ...baseQuote, totalNet: 0, totalVat: 0, vatRate: undefined }} />);

    expect(screen.queryByText(/vat \(/)).not.toBeInTheDocument();
    expect(screen.getAllByText('vat').length).toBeGreaterThanOrEqual(1);
  });

  it('renders shipping method name and Shipping method / Shipping address labels', () => {
    render(<QuoteSummary quote={baseQuote} />);

    expect(screen.getByText('shippingMethod')).toBeInTheDocument();
    expect(screen.getByText('DHL Standard')).toBeInTheDocument();
    expect(screen.getByText('shippingAddress')).toBeInTheDocument();
    expect(screen.queryByText('transportCondition')).not.toBeInTheDocument();
    expect(screen.queryByText('deliveryAddress')).not.toBeInTheDocument();
  });

  it('renders shipping methodId when methodName is absent but methodId is present', () => {
    render(<QuoteSummary quote={{ ...baseQuote, shippingMethod: 'pickup' }} />);

    expect(screen.getByText('pickup')).toBeInTheDocument();
  });

  it('shows an em dash when shipping method is missing', () => {
    render(<QuoteSummary quote={{ ...baseQuote, shippingMethod: '' }} />);

    expect(screen.getByText('—')).toBeInTheDocument();
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

  it('styles Quoted Price with success surface and without dual blue+green border', () => {
    render(<QuoteSummary quote={baseQuote} />);

    const quotedPrice = screen.getByTestId('quote-summary-quoted-price');
    expect(quotedPrice).toHaveClass('bg-surface-success');
    expect(quotedPrice).not.toHaveClass('bg-surface-action-hover-2');
    expect(quotedPrice).not.toHaveClass('border-2');
    expect(quotedPrice).not.toHaveClass('border-border-success');
  });
});
