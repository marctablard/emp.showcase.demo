import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { QuoteUpdateRequest } from '@/platform/services/model/quote';
import { PriceService } from '@/platform/services/price/PriceService';
import { QuoteService } from '@/platform/services/quote/QuoteService';
import { SchemaService } from '@/platform/services/schema/SchemaService';

/**
 * POST /api/quote
 * Creates a quote from the current cart and provided checkout data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const priceService = server.get<PriceService>('PriceService');
    const quoteService = server.get<QuoteService>('QuoteService');
    const schemaService = server.get<SchemaService>('SchemaService');

    const items = Array.isArray(body?.items) ? body.items : undefined;

    if (items && items.length > 0) {
      const defaultUnitCode = process.env.NEXT_PUBLIC_EMPORIX_DEFAULT_UNIT_CODE || 'piece';

      body.items = await Promise.all(
        items.map(async (item: any) => {
          const productId: string | undefined = item?.product?.productId;
          const quantity: number | undefined = item?.quantity?.quantity ?? item?.quantity;
          const unitCode: string = item?.quantity?.unitCode || defaultUnitCode;
          if (!productId || !quantity) return item;

          // Fetch matched price for the product to satisfy required fields
          const matched = await priceService.getProductPrice(productId, quantity);
          if (!matched) return { ...item, quantity: { quantity, unitCode } };

          const unitPrice = matched.amount;
          const taxClass = matched.tax?.taxCode ?? 'STANDARD';
          const taxRate = matched.tax?.taxRate ?? 0;
          const totalNetValue = matched.amount * quantity;

          return {
            ...item,
            quantity: { quantity, unitCode: matched.quantity.unitCode },
            price: {
              priceId: matched.id,
              unitPrice,
              totalNetValue,
              tax: { taxClass, taxRate },
            },
          };
        }),
      );
    }

    const result = await quoteService.createQuote(body);

    if (result.quoteId) {
      try {
        const quoteMixinSchema = await schemaService.getSchema('additionalInfo');
        const updateList: QuoteUpdateRequest[] = [];

        if (body.shipping) {
          updateList.push({ op: 'REPLACE', path: '/shipping', value: body.shipping });
        }
        updateList.push({ op: 'REPLACE', path: '/comment', value: body.comment });
        updateList.push({
          op: 'ADD',
          path: '/mixins/additionalInfo',
          value: { reference: body.reference, userComment: body.userComment },
        });
        updateList.push({ op: 'ADD', path: '/metadata/mixins/additionalInfo', value: quoteMixinSchema.metadata?.url });

        if (updateList.length > 0) {
          await quoteService.updateQuote(result.quoteId, updateList, 'service');
        }
      } catch (updateError) {
        console.error('Failed to update quote :', updateError);
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating quote:', error);
    const message = error instanceof Error ? error.message : 'Failed to create quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
