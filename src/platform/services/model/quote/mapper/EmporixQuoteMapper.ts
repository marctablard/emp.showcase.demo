import { inject } from 'inversify';
import { resolveSingleTaxRate } from '@/lib/common/tax-aggregate';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixQuote, EmporixQuoteShipping } from '@/platform/integrations/emporix/model/quote';
import type { SiteService } from '@/platform/services/site/SiteService';
import type { Quote, QuoteStatus } from '..';
import type { QuoteMapper } from './QuoteMapper';

/**
 * Prefer a localized shipping method name when Emporix provides `methodName`;
 * fall back to `methodId` when the name map is absent or empty.
 */
function resolveQuoteShippingMethodName(shipping?: EmporixQuoteShipping): string {
  const methodName = shipping?.methodName;
  if (methodName && typeof methodName === 'object') {
    const localized = Object.values(methodName).find((value) => typeof value === 'string' && value.trim());
    if (localized) {
      return localized.trim();
    }
  }
  return shipping?.methodId || '';
}

/**
 * Implementation of QuoteMapper for Emporix quotes.
 * Maps Emporix Quote to internal Quote model
 */
@injectable('QuoteMapper', 'Singleton')
export class EmporixQuoteMapper implements QuoteMapper<EmporixQuote> {
  constructor(@inject('SiteService') private siteService: SiteService) {}

  async mapToService(emporixQuote: EmporixQuote): Promise<Quote> {
    const customerName = `${emporixQuote.customer.firstName || ''} ${emporixQuote.customer.lastName || ''}`.trim();

    const approverName = emporixQuote.employee
      ? `${emporixQuote.employee.firstName || ''} ${emporixQuote.employee.lastName || ''}`.trim()
      : undefined;

    const status = emporixQuote.status?.value as QuoteStatus;

    const shippingAddress = emporixQuote.shippingAddress;

    let countryName = 'Germany';
    if (shippingAddress?.countryCode) {
      const country = await this.siteService.getCountry(shippingAddress.countryCode);
      if (country) {
        countryName = typeof country.name === 'string' ? country.name : Object.values(country.name)[0] || countryName;
      }
    }

    return {
      id: emporixQuote.id,
      orderId: emporixQuote.orderId,
      status: status,
      cartId: emporixQuote.cartId,
      submittedDate: emporixQuote.metadata.createdAt,
      customerId: emporixQuote.customer?.customerId || '',
      customerName: customerName,
      employeeComment: emporixQuote.comment?.employeeComment,
      approverId: emporixQuote.employee?.employeeId,
      approverName: approverName,
      currency: emporixQuote.currency,
      totalGross: emporixQuote.totalPrice?.grossValue || 0,
      totalNet: emporixQuote.totalPrice.netValue,
      totalVat: emporixQuote.totalPrice.taxValue,
      subtotalNet: emporixQuote.subtotalPrice?.netValue,
      subtotalVat: emporixQuote.subtotalPrice?.taxValue,
      vatRate: resolveSingleTaxRate(emporixQuote.taxAggregate?.lines),
      taxAggregate: emporixQuote.taxAggregate,
      items: (emporixQuote.items || []).map((item) => ({
        product: {
          id: item.product.productId,
          name: item.product.name,
          quantity: item.quantity.quantity,
          itemPrice: {
            amount: item.price?.tax?.prices?.grossValue || 0,
            currency: emporixQuote.currency,
            baseAmount: item.price?.totalNetValue || 0,
            tax: (item.price?.tax?.prices?.grossValue || 0) - (item.price?.totalNetValue || 0),
            grossValue: item.price?.tax?.prices?.grossValue,
            netValue: item.price?.tax?.prices?.netValue,
            unitPrice: item.price?.unitPrice,
            newUnitPrice: item.price?.newUnitPrice,
            discount: item.price?.discount,
            taxRate: item.price?.tax?.taxRate,
          },
        },
        quantity: {
          quantity: item.quantity.quantity,
          unitCode: item.quantity.unitCode,
        },
      })),
      shippingAddress: {
        type: 'SHIPPING',
        contactName: shippingAddress?.name || '',
        // Omit missing addressLine2 — string concat would render the literal "undefined"
        street: [shippingAddress?.addressLine1, shippingAddress?.addressLine2]
          .map((part) => part?.trim())
          .filter((part): part is string => Boolean(part))
          .join(' '),
        zipCode: shippingAddress?.postcode || '',
        city: shippingAddress?.city || '',
        country: countryName,
      },
      shippingCost: emporixQuote.shipping?.value || 0,
      shippingGross: emporixQuote.shipping?.grossValue,
      shippingTaxRate: emporixQuote.shipping?.taxRate,
      // Prefer localized methodName over methodId (OQ6 / Task 3.1)
      shippingMethod: resolveQuoteShippingMethodName(emporixQuote.shipping),
      reference: emporixQuote.customerReference || emporixQuote.mixins?.additionalInfo?.reference,
      userComment: emporixQuote.customerComment || emporixQuote.mixins?.additionalInfo?.userComment,
    };
  }
}

export default EmporixQuoteMapper;
