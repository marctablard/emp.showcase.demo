import { inject } from 'inversify';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { injectable } from '@/platform/core/di/injectable';
import type {
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
  OrderStatus,
} from '@/platform/services/model/order/order';

/**
 * Implementation of OrderMapper for Emporix order data
 */
@injectable('EmporixOrderMapper', 'Singleton')
class EmporixOrderMapper implements OrderMapper<EmporixOrder> {
  constructor(@inject('EmporixAddressMapper') private addressMapper: EmporixAddressMapper) {}

  mapToService(integrationModel: EmporixOrder): Order {
    return {
      id: integrationModel.id,
      status: integrationModel.status as OrderStatus,
      createdAt: integrationModel.created,
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
      shipping: this.mapShipping(integrationModel.shipping),
      price: this.mapPrice(integrationModel.calculatedPrice, integrationModel.currency),
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
    };
  }

  mapToSource(serviceModel: Order): EmporixOrder {
    return {
      id: serviceModel.id,
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

  private mapShipping(shipping?: EmporixShipping): OrderShipping | undefined {
    if (!shipping) {
      return undefined;
    }

    return {
      total: {
        value: shipping.total.amount,
        currency: shipping.total.currency,
      },
      methods: shipping.lines?.map((line) => {
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

  private mapPrice(calculatedPrice?: any, currency?: string): OrderPrice | undefined {
    if (!calculatedPrice || !currency) {
      return undefined;
    }

    return {
      subtotal: {
        net: calculatedPrice.price.netValue,
        gross: calculatedPrice.price.grossValue,
        tax: calculatedPrice.price.taxValue,
        currency,
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
