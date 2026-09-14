import { inject } from 'inversify';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { resolveSharedPositiveTaxRate } from '@/lib/common/tax-aggregate';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixDiscount,
  EmporixOrder,
  EmporixOrderEntry,
  EmporixPayment,
  EmporixShipping,
} from '@/platform/integrations/emporix/model/order';
import type { EmporixAddressMapper } from '@/platform/services/model/common/impl/EmporixAddressMapper';
import type { OrderMapper } from '@/platform/services/model/order/OrderMapper';
import type {
  Order,
  OrderDiscount,
  OrderItem,
  OrderPayment,
  OrderPrice,
  OrderShipping,
  TotalDiscountCalculationType,
} from '@/platform/services/model/order/order';

function resolveOrderGoodsTaxRate(
  itemRates: Array<number | undefined>,
  fallbackGoodsRate: number | undefined,
): number | undefined {
  const fromItems = resolveSharedPositiveTaxRate(itemRates);
  if (fromItems !== undefined) {
    return fromItems;
  }
  const hasAnyItemRate = itemRates.some((rate) => typeof rate === 'number');
  if (hasAnyItemRate) {
    return undefined;
  }
  return typeof fallbackGoodsRate === 'number' && fallbackGoodsRate > 0 ? fallbackGoodsRate : undefined;
}

function isApplyBasis(value: string | undefined): value is TotalDiscountCalculationType {
  return value === 'ApplyDiscountBeforeTax' || value === 'ApplyDiscountAfterTax';
}

function resolveTotalDiscountCalculationType(
  publishedType: string | undefined,
  discounts: EmporixDiscount[] | undefined,
): TotalDiscountCalculationType | undefined {
  if (isApplyBasis(publishedType)) {
    return publishedType;
  }
  const fromDiscount = discounts?.find((discount) => isApplyBasis(discount.calculationType))?.calculationType;
  return isApplyBasis(fromDiscount) ? fromDiscount : undefined;
}

function mapPublishedCouponFields(
  integrationModel: EmporixOrder,
): Pick<
  Order,
  | 'savingsTotal'
  | 'totalDiscountCalculationType'
  | 'includesTax'
  | 'goodsDiscountedNet'
  | 'goodsDiscountedVat'
  | 'goodsDiscountedGross'
> {
  const totalDiscount = integrationModel.calculatedPrice?.totalDiscount;
  const discountedPrice = integrationModel.calculatedPrice?.discountedPrice;
  const totalDiscountCalculationType = resolveTotalDiscountCalculationType(
    totalDiscount?.calculationType,
    integrationModel.discounts,
  );
  return {
    ...(totalDiscount ? { savingsTotal: totalDiscount.value } : {}),
    ...(totalDiscountCalculationType
      ? {
          totalDiscountCalculationType,
          includesTax: totalDiscountCalculationType === 'ApplyDiscountAfterTax',
        }
      : {}),
    ...(discountedPrice
      ? {
          goodsDiscountedNet: discountedPrice.netValue,
          goodsDiscountedVat: discountedPrice.taxValue,
          goodsDiscountedGross: discountedPrice.grossValue,
        }
      : {}),
  };
}

/**
 * Implementation of OrderMapper for Emporix order data
 */
@injectable('EmporixOrderMapper', 'Singleton')
class EmporixOrderMapper implements OrderMapper<EmporixOrder> {
  constructor(@inject('EmporixAddressMapper') private readonly addressMapper: EmporixAddressMapper) {}

  mapToService(integrationModel: EmporixOrder): Order {
    return {
      id: integrationModel.id,
      quoteId: integrationModel.quoteId,
      status: integrationModel.status,
      createdAt: integrationModel.created,
      expectedDeliveryDate: this.resolveExpectedDeliveryDate(integrationModel),
      lastStatusChange: integrationModel.lastStatusChange,
      items: this.mapOrderItems(integrationModel.entries),
      billingAddress: integrationModel.billingAddress
        ? this.addressMapper.mapToService(integrationModel.billingAddress)
        : undefined,
      shippingAddress: integrationModel.shippingAddress
        ? this.addressMapper.mapToService(integrationModel.shippingAddress)
        : undefined,
      payments: this.mapPayments(integrationModel.payments),
      discounts: integrationModel.discounts?.map((discount) => ({
        code: discount.code,
        value: discount.amount,
        currency: discount.currency,
        description: discount.description,
      })),
      shipping: this.mapShipping(
        integrationModel.shipping,
        integrationModel.calculatedPrice,
        integrationModel.currency,
      ),
      price: this.mapPrice(integrationModel.calculatedPrice, integrationModel.currency, integrationModel.entries),
      currency: integrationModel.currency,
      customer: integrationModel.customer
        ? {
            id: integrationModel.customer.id,
            name: integrationModel.customer.name,
            firstName: integrationModel.customer.firstName,
            lastName: integrationModel.customer.lastName,
            email: integrationModel.customer.email,
          }
        : undefined,
      customerEmail: integrationModel.customer?.email,
      customerNote: integrationModel.customerNote,
      ...mapPublishedCouponFields(integrationModel),
    };
  }

  private resolveExpectedDeliveryDate(integrationModel: EmporixOrder): string | undefined {
    const shipmentExpectedDeliveryDate = integrationModel.shipments?.find(
      (shipment) => typeof shipment.expectDeliveryOn === 'string' && shipment.expectDeliveryOn.length > 0,
    )?.expectDeliveryOn;

    if (shipmentExpectedDeliveryDate) {
      return shipmentExpectedDeliveryDate;
    }

    return integrationModel.deliveryWindow?.deliveryDate;
  }

  mapToSource(serviceModel: Order): EmporixOrder {
    return {
      id: serviceModel.id,
      quoteId: serviceModel.quoteId,
      status: serviceModel.status,
      lastStatusChange: serviceModel.lastStatusChange,
      creationDate: serviceModel.createdAt,
      entries: serviceModel.items.map((item: OrderItem) => ({
        id: item.id,
        itemYrn: `urn:yaas:saasag:caasproduct:product:${item.productId}`,
        amount: item.quantity,
        product: item.name
          ? {
              id: item.productId,
              name: item.name,
              description: item.description,
              sku: item.sku,
              images: item.images?.map((url: string) => ({
                id: url,
                url: url,
              })),
            }
          : undefined,
        price: item.price
          ? {
              effectiveAmount: item.price.value,
              originalAmount: item.price.originalValue,
              currency: item.price.currency,
            }
          : undefined,
      })),
      customer: {
        id: CUSTOMER_ID.SESSION_ANONYMOUS,
        email: serviceModel.customerEmail,
      },
      billingAddress: serviceModel.billingAddress
        ? this.addressMapper.mapToSource(serviceModel.billingAddress)
        : undefined,
      shippingAddress: serviceModel.shippingAddress
        ? this.addressMapper.mapToSource(serviceModel.shippingAddress)
        : undefined,
      payments: this.mapPaymentsToEmporix(serviceModel.payments),
      discounts: serviceModel.discounts?.map((discount: OrderDiscount) => ({
        code: discount.code,
        amount: discount.value,
        currency: discount.currency,
        description: discount.description,
      })),
      currency: serviceModel.currency,
      customerNote: serviceModel.customerNote,
    };
  }

  private mapOrderItems(entries?: EmporixOrderEntry[]): OrderItem[] {
    if (!entries) {
      return [];
    }

    return entries.map((entry) => ({
      id: entry.id,
      productId: entry.product?.id || entry.itemYrn.split(':').pop() || '',
      quantity: entry.amount,
      name: entry.product?.name,
      description: entry.product?.description,
      vendorName: entry.product?.vendor?.name,
      sku: entry.product?.sku,
      images: entry.product?.images?.map((img) => img.url),
      price: entry.price
        ? {
            value: entry.price.effectiveAmount,
            netValue:
              entry.calculatedPrice?.finalPrice?.netValue !== undefined && entry.amount > 0
                ? entry.calculatedPrice.finalPrice.netValue / entry.amount
                : undefined,
            originalValue: entry.price.originalAmount,
            grossValue:
              entry.calculatedPrice?.finalPrice?.grossValue !== undefined && entry.amount > 0
                ? entry.calculatedPrice.finalPrice.grossValue / entry.amount
                : undefined,
            currency: entry.price.currency,
          }
        : undefined,
    }));
  }

  // Address mapping is now handled by the EmporixAddressMapper

  private mapPayments(payments?: EmporixPayment[]): OrderPayment[] | undefined {
    if (!payments || payments.length === 0) {
      return undefined;
    }

    return payments.map((payment) => ({
      status: payment.status,
      method: payment.method,
      response: payment.paymentResponse,
      amount: payment.paidAmount,
      currency: payment.currency,
      transactionId: payment.transactionId,
      transactionDate: payment.transactionDate,
    }));
  }

  private mapPaymentsToEmporix(payments?: OrderPayment[]): EmporixPayment[] | undefined {
    if (!payments || payments.length === 0) {
      return undefined;
    }

    return payments.map((payment) => ({
      status: payment.status,
      method: payment.method,
      paymentResponse: payment.response,
      paidAmount: payment.amount,
      currency: payment.currency,
      transactionId: payment.transactionId,
      transactionDate: payment.transactionDate,
    }));
  }

  private mapShipping(
    shipping?: EmporixShipping,
    calculatedPrice?: { totalShipping?: { netValue: number; taxValue?: number; taxRate?: number } },
    currency?: string,
  ): OrderShipping | undefined {
    const shippingValue = calculatedPrice?.totalShipping?.netValue ?? shipping?.total.amount;
    const shippingCurrency = shipping?.total.currency ?? currency;
    const shippingTax = calculatedPrice?.totalShipping?.taxValue;
    const shippingTaxRateFromLine = shipping?.lines?.find((line) => typeof line.tax?.rate === 'number')?.tax?.rate;
    const shippingTaxRate = calculatedPrice?.totalShipping?.taxRate ?? shippingTaxRateFromLine;

    if (shippingValue === undefined || !shippingCurrency) {
      return undefined;
    }

    return {
      total: {
        value: shippingValue,
        currency: shippingCurrency,
        ...(shippingTax === undefined ? {} : { tax: shippingTax }),
        ...(shippingTaxRate === undefined ? {} : { taxRate: shippingTaxRate }),
      },
      methods: shipping?.lines?.map((line) => {
        const localizedName = line.localizedName;
        const firstLocalized =
          localizedName && typeof localizedName === 'object' ? Object.values(localizedName)[0] : undefined;
        return {
          id: line.code,
          name: line.name ?? firstLocalized ?? line.code,
          localizedName,
          description: line.description,
          price: line.amount,
          currency: line.currency,
        };
      }),
    };
  }

  private mapPrice(
    calculatedPrice?: EmporixOrder['calculatedPrice'],
    currency?: string,
    entries?: EmporixOrderEntry[],
  ): OrderPrice | undefined {
    if (!calculatedPrice || !currency) {
      return undefined;
    }

    const itemRates = (entries ?? []).map((entry) => entry.calculatedPrice?.price?.taxRate);
    const goodsTaxRate = resolveOrderGoodsTaxRate(itemRates, calculatedPrice.price?.taxRate);

    return {
      subtotal: {
        net: calculatedPrice.price.netValue,
        gross: calculatedPrice.price.grossValue,
        tax: calculatedPrice.price.taxValue,
        currency,
        ...(typeof goodsTaxRate === 'number' ? { taxRate: goodsTaxRate } : {}),
      },
      total: {
        net: calculatedPrice.finalPrice.netValue,
        gross: calculatedPrice.finalPrice.grossValue,
        tax: calculatedPrice.finalPrice.taxValue,
        currency,
      },
    };
  }
}

export default EmporixOrderMapper;
