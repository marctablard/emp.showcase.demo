import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { EmporixTokenManager } from '@/platform/integrations/emporix/common/EmporixTokenManager';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteService } from '@/platform/services/quote/QuoteService';

const DEFAULT_WEBHOOK_URL = 'https://hook.emporix-cop.integromat.celonis.com/bv4d6h9rbpygnke84qjs2cf73i9ff1uv';

const NOTIFICATION_ID_KEYS = ['QUOTE_ADDITEM_NOTIFICATIONS_ID', 'quote_additem_notifications_id'] as const;

interface AddQuoteProductItem {
  productId?: string;
  quantity?: number | string;
}

interface AddQuoteProductsBody {
  quoteId?: string;
  items?: AddQuoteProductItem[];
}

export interface QuoteAddProductRequest {
  productId: string;
  notificationId: string;
}

function getWebhookUrl(): string {
  return process.env.QUOTE_ADD_PRODUCT_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL;
}

function extractNotificationId(responseBody: string): string | null {
  const trimmed = responseBody.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of NOTIFICATION_ID_KEYS) {
      const value = parsed[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    for (const value of Object.values(parsed)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        for (const key of NOTIFICATION_ID_KEYS) {
          const id = nested[key];
          if (typeof id === 'string' && id.trim()) {
            return id.trim();
          }
        }
      }
    }
  } catch {
    if (/^[a-f0-9]{24}$/i.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  let quoteId: string | undefined;

  try {
    const body = (await request.json()) as AddQuoteProductsBody;
    quoteId = body.quoteId;
    const items = body.items ?? [];

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one product is required' }, { status: 400 });
    }

    const invalidItem = items.find(
      (item) => !item.productId?.trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1,
    );
    if (invalidItem) {
      return NextResponse.json(
        { error: 'Each item must include a productId and quantity of at least 1' },
        { status: 400 },
      );
    }

    const customerService = server.get<CustomerService>('CustomerService');
    const currentCustomer = await customerService.getCustomer();
    if (!currentCustomer?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const quoteService = server.get<QuoteService>('QuoteService');
    const quote = await quoteService.getQuote(quoteId);
    if (quote.status !== 'OPEN') {
      return NextResponse.json({ error: 'Products can only be added to open quotes' }, { status: 409 });
    }

    const config = server.get<EmporixConfig>('EmporixConfig');
    const tokenManager = server.get<EmporixTokenManager>('EmporixTokenManager');
    const customerToken = await tokenManager.getCustomerToken(config.tenant, config.clientId);
    if (!customerToken?.accessToken) {
      return NextResponse.json({ error: 'Customer access token is required' }, { status: 401 });
    }

    const webhookUrl = getWebhookUrl();
    const failures: Array<{ productId: string; status: number; message: string }> = [];
    const requests: QuoteAddProductRequest[] = [];

    for (const item of items) {
      const productId = item.productId!.trim();
      const quantity = String(Math.floor(Number(item.quantity)));

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          productId,
          quantity,
          customerAccessToken: customerToken.accessToken,
        }),
      });

      const responseBody = await response.text().catch(() => '');

      if (!response.ok) {
        failures.push({
          productId,
          status: response.status,
          message: responseBody || response.statusText,
        });
        continue;
      }

      const notificationId = extractNotificationId(responseBody);
      if (!notificationId) {
        failures.push({
          productId,
          status: 502,
          message: 'Webhook response did not include QUOTE_ADDITEM_NOTIFICATIONS_ID',
        });
        continue;
      }

      requests.push({ productId, notificationId });
    }

    if (failures.length > 0) {
      const logger = server.get<LoggerService>('LoggerService');
      logger.error({ quoteId, failures }, 'Failed to add one or more products to quote via webhook');
      return NextResponse.json(
        {
          error: 'Failed to add one or more products to the quote',
          failures,
          requests,
        },
        { status: failures.length === items.length ? 502 : 207 },
      );
    }

    return NextResponse.json({ accepted: true, requests }, { status: 200 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/quote/add-products',
        method: 'POST',
        quoteId,
      },
      'Error adding products to quote',
    );
    const message = error instanceof Error ? error.message : 'Failed to add products to quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
