'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { hasResolvedWidgetPayload } from '@/lib/common/ai-tool-widgets';
import { UnrecognizedResponseFallback } from './UnrecognizedResponseFallback';
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
import { WidgetSkeleton } from './renderers/WidgetSkeleton';
import type {
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
import { UNRECOGNIZED_RESPONSE_TYPE } from './utils/unrecognized-response';

interface StructuredDataRendererProps {
  type: StructuredDataType | string;
  data: any;
  handlers: StructuredDataHandlers;
  streaming?: boolean;
}

export { hasResolvedWidgetPayload } from '@/lib/common/ai-tool-widgets';

export const StructuredDataRenderer: React.FC<StructuredDataRendererProps> = ({
  type,
  data,
  handlers,
  streaming = false,
}) => {
  const t = useTranslations('account.AiHelper');

  const handleAddToCart = (productId: string, quantity: number) => {
    const message = t('addToCartMessage', { productId, quantity });
    handlers.setQuestionValue(message);
    requestAnimationFrame(() => {
      handlers.handleQuestionSubmit({ question: message });
    });
  };

  if (type === UNRECOGNIZED_RESPONSE_TYPE) {
    return <UnrecognizedResponseFallback data={data} />;
  }

  if (type !== 'text' && type !== 'html' && !hasResolvedWidgetPayload(type, data)) {
    return streaming ? <WidgetSkeleton /> : <UnrecognizedResponseFallback data={data} />;
  }

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
      // Intro + nested data.message are rendered by ChatMessage.
      return null;

    case 'error':
      return <ErrorRenderer data={data as ErrorData} {...handlers} />;

    default:
      return <UnrecognizedResponseFallback data={data} />;
  }
};
