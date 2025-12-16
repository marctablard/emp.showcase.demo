import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { EmporixQuote } from '@/platform/integrations/emporix/model/quote';
import type { SiteService } from '@/platform/services/site/SiteService';
import { Quote, QuoteStatus } from '..';
import type { QuoteMapper } from './QuoteMapper';

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
        street: shippingAddress?.addressLine1 + ' ' + shippingAddress?.addressLine2,
        zipCode: shippingAddress?.postcode || '',
        city: shippingAddress?.city || '',
        country: countryName,
      },
      shippingCost: emporixQuote.shipping?.value || 0,
      shippingMethod: emporixQuote.shipping?.methodId || '',
      reference: emporixQuote.mixins?.additionalInfo?.reference,
      userComment: emporixQuote.mixins?.additionalInfo?.userComment,
    };
  }
}

export default EmporixQuoteMapper;
