'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StructuredDataHandlers, AiHelperFormData } from './types';
import { CartSummaryRenderer } from './renderers/CartSummaryRenderer';
import { ProductCard } from './renderers/ProductCard';
import { ProductSelection } from './renderers/ProductSelection';
import { AccountDetailsRenderer } from './renderers/AccountDetailsRenderer';
import { OrderListRenderer } from './renderers/OrderListRenderer';
import { OrderSummaryRenderer } from './renderers/OrderSummaryRenderer';
import { ProductListRenderer } from './renderers/ProductListRenderer';
import { AddressListRenderer } from './renderers/AddressListRenderer';
import { QuoteListRenderer } from './renderers/QuoteListRenderer';
import { QuoteDetailsRenderer } from './renderers/QuoteDetailsRenderer';
import { ReturnListRenderer } from './renderers/ReturnListRenderer';
import { ReturnDetailsRenderer } from './renderers/ReturnDetailsRenderer';
import { ErrorRenderer } from './renderers/ErrorRenderer';
import { TableRenderer } from './renderers/TableRenderer';
import { HTMLRenderer } from './renderers/HTMLRenderer';

interface StructuredDataRendererProps {
  type: string;
  data: any;
  handlers: StructuredDataHandlers;
  fallbackCurrency?: string;
}

export const StructuredDataRenderer: React.FC<StructuredDataRendererProps> = ({
  type,
  data,
  handlers,
  fallbackCurrency = 'USD',
}) => {
  const t = useTranslations('account.AiHelper');

  const handleAddToCart = (productId: string, quantity: number) => {
    const message = t('addToCartMessage', { productId, quantity });
    handlers.setQuestionValue(message);
    // Use requestAnimationFrame for better timing than setTimeout
    requestAnimationFrame(() => {
      handlers.handleQuestionSubmit({ question: message });
    });
  };

  switch (type) {
    case 'cart_summary':
      return <CartSummaryRenderer data={data} currency={data.currency || fallbackCurrency} />;

    case 'account_details':
      return <AccountDetailsRenderer data={data} />;

    case 'order_list':
      return <OrderListRenderer data={data} />;

    case 'order_summary':
      return <OrderSummaryRenderer data={data} fallbackCurrency={fallbackCurrency} />;

    case 'product_list':
      return <ProductListRenderer data={data} onAddToCart={handleAddToCart} />;

    case 'product_selection':
      return <ProductSelection data={data} {...handlers} />;

    case 'address_list':
      return <AddressListRenderer data={data} />;

    case 'quote_list':
      return <QuoteListRenderer data={data} />;

    case 'quote_details':
      return <QuoteDetailsRenderer data={data} fallbackCurrency={fallbackCurrency} />;

    case 'return_list':
      return <ReturnListRenderer data={data} />;

    case 'return_details':
      return <ReturnDetailsRenderer data={data} />;

    case 'table':
      return <TableRenderer data={data} />;

    case 'html':
      return <HTMLRenderer data={data} />;

    case 'text':
      // For text type, only the message content should be displayed
      return null;

    case 'error':
      return <ErrorRenderer data={data} {...handlers} />;

    default:
      return (
        <div className="text-sm text-text-body">
          <pre className="text-sm bg-surface-primary p-3 rounded border overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </div>
      );
  }
};

