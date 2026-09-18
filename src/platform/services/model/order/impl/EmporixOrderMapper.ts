import { inject } from 'inversify';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { resolveSharedPositiveTaxRate } from '@/lib/common/tax-aggregate';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixDiscount,
  EmporixOrder,
  EmporixOrderCalculatedPrice,
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

function asOrderDiscountType(value: string | undefined): OrderDiscount['type'] | undefined {
  if (value === 'PERCENT' || value === 'ABSOLUTE' || value === 'FREE_SHIPPING') {
    return value;
  }
  return undefined;
}

function isInternalOrUnoriginated(row: { origin?: string }): boolean {
  return row.origin === 'INTERNAL' || row.origin === undefined;
}

type CalculatedAppliedDiscountRow = {
  id?: string;
  value: number;
  discountType?: string;
  origin?: string;
};

function appliedDiscountSources(
  calculatedPrice: EmporixOrderCalculatedPrice | undefined,
): CalculatedAppliedDiscountRow[][] {
  return [
    calculatedPrice?.totalDiscount?.appliedDiscounts ?? [],
    calculatedPrice?.discountedPrice?.appliedDiscounts ?? [],
    calculatedPrice?.totalFee?.appliedDiscounts ?? [],
    calculatedPrice?.totalShipping?.appliedDiscounts ?? [],
  ];
}

function matchingAppliedDiscountRows(
  discount: EmporixDiscount,
  calculatedPrice: EmporixOrderCalculatedPrice | undefined,
  inferSoleIdLess: boolean,
): CalculatedAppliedDiscountRow[] {
  const [aggregate, goods, fees, shipping] = appliedDiscountSources(calculatedPrice);
  const components = [...goods, ...fees, ...shipping];
  const byIdAggregate = aggregate.filter((row) => typeof row.id === 'string' && row.id === discount.code);
  if (byIdAggregate.length > 0) {
    return byIdAggregate;
  }
  const byIdComponents = components.filter((row) => typeof row.id === 'string' && row.id === discount.code);
  if (byIdComponents.length > 0) {
    return byIdComponents;
  }
  if (!inferSoleIdLess) {
    return [];
  }
  const idLessAggregate = aggregate.filter((row) => row.id === undefined && isInternalOrUnoriginated(row));
  if (idLessAggregate.length > 0) {
    return idLessAggregate;
  }
  return components.filter((row) => row.id === undefined && isInternalOrUnoriginated(row));
}

function firstTypedAppliedDiscountRow(
  rows: CalculatedAppliedDiscountRow[],
  match: (row: CalculatedAppliedDiscountRow) => boolean,
): OrderDiscount['type'] | undefined {
  for (const row of rows) {
    if (!match(row)) {
      continue;
    }
    const type = asOrderDiscountType(row.discountType);
    if (type) {
      return type;
    }
  }
  return undefined;
}

function appliedDiscountMatchesCode(row: CalculatedAppliedDiscountRow, code: string): boolean {
  return typeof row.id === 'string' && row.id === code;
}

function appliedDiscountIsSoleIdLess(row: CalculatedAppliedDiscountRow): boolean {
  return row.id === undefined && isInternalOrUnoriginated(row);
}

function firstTypedAppliedDiscount(
  discount: EmporixDiscount,
  calculatedPrice: EmporixOrderCalculatedPrice | undefined,
  inferSoleIdLess: boolean,
): OrderDiscount['type'] | undefined {
  const rows = appliedDiscountSources(calculatedPrice).flat();
  const byId = firstTypedAppliedDiscountRow(rows, (row) => appliedDiscountMatchesCode(row, discount.code));
  if (byId) {
    return byId;
  }
  if (!inferSoleIdLess) {
    return undefined;
  }
  return firstTypedAppliedDiscountRow(rows, appliedDiscountIsSoleIdLess);
}

function resolveOrderDiscountType(
  discount: EmporixDiscount,
  calculatedPrice: EmporixOrderCalculatedPrice | undefined,
  inferSoleIdLess: boolean,
): OrderDiscount['type'] | undefined {
  return (
    asOrderDiscountType(discount.discountType) ?? firstTypedAppliedDiscount(discount, calculatedPrice, inferSoleIdLess)
  );
}

function resolveOrderDiscountValue(
  discount: EmporixDiscount,
  calculatedPrice: EmporixOrderCalculatedPrice | undefined,
  inferSoleIdLess: boolean,
): number {
  if (typeof discount.amount === 'number') {
    return discount.amount;
  }
  const withValue = matchingAppliedDiscountRows(discount, calculatedPrice, inferSoleIdLess).filter(
    (row) => typeof row.value === 'number',
  );
  if (withValue.length === 0) {
    return 0;
  }
  return withValue.reduce((sum, row) => sum + row.value, 0);
}

function mapOrderDiscount(
  discount: EmporixDiscount,
  calculatedPrice: EmporixOrderCalculatedPrice | undefined,
  inferSoleIdLess: boolean,
): OrderDiscount {
  const type = resolveOrderDiscountType(discount, calculatedPrice, inferSoleIdLess);
  return {
    code: discount.code,
    value: resolveOrderDiscountValue(discount, calculatedPrice, inferSoleIdLess),
    currency: discount.currency,
    description: discount.description ?? discount.name,
    ...(type ? { type } : {}),
  };
}

function isShopperOrderSourceDiscount(discount: EmporixDiscount): boolean {
  return discount.code !== 'TOTAL';
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
    const sourceDiscounts = integrationModel.discounts ?? [];
    const inferSoleIdLess = sourceDiscounts.filter(isShopperOrderSourceDiscount).length === 1;
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
      discounts: integrationModel.discounts?.map((discount) =>
        mapOrderDiscount(
          discount,
          integrationModel.calculatedPrice,
          inferSoleIdLess && isShopperOrderSourceDiscount(discount),
        ),
      ),
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
