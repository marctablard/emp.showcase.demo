'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AccountDetailsRenderer } from './renderers/AccountDetailsRenderer';
import { AddressListRenderer } from './renderers/AddressListRenderer';
import { CartSummaryRenderer } from './renderers/CartSummaryRenderer';
import { ErrorRenderer } from './renderers/ErrorRenderer';
import { HTMLRenderer } from './renderers/HTMLRenderer';
import { OrderListRenderer } from './renderers/OrderListRenderer';
import { OrderSummaryRenderer } from './renderers/OrderSummaryRenderer';
import { ProductListRenderer } from './renderers/ProductListRenderer';
import { ProductSelection } from './renderers/ProductSelection';
import { QuoteDetailsRenderer } from './renderers/QuoteDetailsRenderer';
import { QuoteListRenderer } from './renderers/QuoteListRenderer';
import { ReturnDetailsRenderer } from './renderers/ReturnDetailsRenderer';
import { ReturnListRenderer } from './renderers/ReturnListRenderer';
import { TableRenderer } from './renderers/TableRenderer';
import {
  AccountDetailsData,
  AddressListData,
  CartSummaryData,
  ErrorData,
  HTMLData,
  OrderListData,
  OrderSummaryData,
  ProductListData,
  ProductSelectionData,
  QuoteDetailsData,
  QuoteListData,
  ReturnDetailsData,
  ReturnListData,
  StructuredDataHandlers,
  StructuredDataType,
  TableData,
} from './types';

interface StructuredDataRendererProps {
  type: StructuredDataType | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  handlers: StructuredDataHandlers;
}

export const StructuredDataRenderer: React.FC<StructuredDataRendererProps> = ({ type, data, handlers }) => {
  const t = useTranslations('account.AiHelper');

  const handleAddToCart = (productId: string, quantity: number) => {
    const message = t('addToCartMessage', { productId, quantity });
    handlers.setQuestionValue(message);
    requestAnimationFrame(() => {
      handlers.handleQuestionSubmit({ question: message });
    });
  };

  switch (type) {
    case 'cart_summary':
      return <CartSummaryRenderer data={data as CartSummaryData} />;

    case 'account_details':
      return <AccountDetailsRenderer data={data as AccountDetailsData} />;

    case 'order_list':
      return <OrderListRenderer data={data as OrderListData} />;

    case 'order_summary':
      return <OrderSummaryRenderer data={data as OrderSummaryData} />;

    case 'product_list':
      return <ProductListRenderer data={data as ProductListData} onAddToCart={handleAddToCart} />;

    case 'product_selection':
      return <ProductSelection data={data as ProductSelectionData} {...handlers} />;

    case 'address_list':
      return <AddressListRenderer data={data as AddressListData} />;

    case 'quote_list':
      return <QuoteListRenderer data={data as QuoteListData} />;

    case 'quote_details':
      return <QuoteDetailsRenderer data={data as QuoteDetailsData} />;

    case 'return_list':
      return <ReturnListRenderer data={data as ReturnListData} />;

    case 'return_details':
      return <ReturnDetailsRenderer data={data as ReturnDetailsData} />;

    case 'table':
      return <TableRenderer data={data as TableData} />;

    case 'html':
      return <HTMLRenderer data={data as HTMLData} />;

    case 'text':
      // For text type, only the message content should be displayed
      return null;

    case 'error':
      return <ErrorRenderer data={data as ErrorData} {...handlers} />;

    default:
      return (
        <div className="text-sm text-text-body">
          <pre className="text-sm bg-surface-primary p-3 rounded border overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }
};
