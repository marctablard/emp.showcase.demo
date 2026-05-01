import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteUpdateRequest } from '@/platform/services/model/quote';
import type { QuoteService } from '@/platform/services/quote/QuoteService';
import type { SchemaService } from '@/platform/services/schema/SchemaService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * POST /api/quote
 *
 * Creates a quote from the shopper's current cart using the Emporix
 * `QuoteCreateFromCartRequest` shape (customer session token, scope
 * `quote.quote_manage_own`). The client is allowed to send additional
 * metadata at the top level of the body (`reference`, `userComment`,
 * `comment`) — those are stripped from the Emporix payload and re-applied
 * via PATCH after the quote id is returned so the BFF contract is stable
 * across client callers.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cartId, billingAddressId, shippingAddressId, shipping, reference, userComment, comment } = body ?? {};

    const quoteService = server.get<QuoteService>('QuoteService');
    const schemaService = server.get<SchemaService>('SchemaService');
    const sessionService = server.get<SessionService>('SessionService');
    const logger = server.get<LoggerService>('LoggerService');

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    try {
      const session = await sessionService.getCurrent();
      const customerService = server.get<CustomerService>('CustomerService');
      let customerBusinessModel: string | undefined;
      let customerLegalEntityId: string | undefined;
      try {
        const customer = await customerService.getCustomer();
        customerBusinessModel = customer?.businessModel;
        customerLegalEntityId = customer?.legalEntityId;
      } catch {
        customerBusinessModel = undefined;
        customerLegalEntityId = undefined;
      }
      const sessionLegalEntityId = session?.legalEntityId;
      logger.info(
        {
          route: '/api/quote',
          method: 'POST',
          hasLegalEntityInSession: Boolean(sessionLegalEntityId),
          hasLegalEntityOnCustomer: Boolean(customerLegalEntityId),
          sessionLegalEntityId: sessionLegalEntityId ?? null,
          customerLegalEntityId: customerLegalEntityId ?? null,
          customerBusinessModel: customerBusinessModel ?? null,
          cartId,
          payloadBillingAddressId: billingAddressId ?? null,
          payloadShippingAddressId: shippingAddressId ?? null,
          tokenTypeUsed: 'session',
        },
        'Quote create (from-cart) — B2B context snapshot',
      );
    } catch (diagError) {
      logger.warn(
        { error: diagError instanceof Error ? diagError.message : String(diagError) },
        'Quote create — failed to collect B2B context snapshot',
      );
    }

    const wireBody = {
      cartId,
      billingAddressId,
      shippingAddressId,
      shipping,
    };

    const result = await quoteService.createQuote(wireBody);

    if (result.quoteId) {
      try {
        const updateList: QuoteUpdateRequest[] = [];

        // `shipping` is sent in the create body (QuoteCreateFromCartRequest
        // accepts it natively — see Emporix Quote Tutorial). Patching it
        // again here would be redundant, so it is intentionally omitted from
        // the post-create update list.

        if (comment !== undefined && comment !== '') {
          updateList.push({ op: 'REPLACE', path: '/comment', value: comment });
        }

        const hasReference = reference !== undefined && reference !== '';
        const hasUserComment = userComment !== undefined && userComment !== '';
        if (hasReference || hasUserComment) {
          const quoteMixinSchema = await schemaService.getSchema('additionalInfo');
          updateList.push({
            op: 'ADD',
            path: '/mixins/additionalInfo',
            value: {
              ...(hasReference ? { reference } : {}),
              ...(hasUserComment ? { userComment } : {}),
            },
          });
          if (quoteMixinSchema?.metadata?.url) {
            updateList.push({
              op: 'ADD',
              path: '/metadata/mixins/additionalInfo',
              value: quoteMixinSchema.metadata.url,
            });
          }
        }

        if (updateList.length > 0) {
          await quoteService.updateQuote(result.quoteId, updateList, 'service');
        }
      } catch (updateError) {
        logger.error(
          {
            error: updateError instanceof Error ? updateError.message : String(updateError),
            stack: updateError instanceof Error ? updateError.stack : undefined,
            path: '/api/quote',
            method: 'POST',
            quoteId: result.quoteId,
          },
          'Failed to update quote',
        );
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/quote',
        method: 'POST',
      },
      'Error creating quote',
    );
    const message = error instanceof Error ? error.message : 'Failed to create quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
