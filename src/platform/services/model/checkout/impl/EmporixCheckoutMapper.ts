import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixCartCheckoutRequest,
  EmporixCheckoutAddress,
  EmporixCheckoutCustomer,
  EmporixCheckoutPaymentMethod,
  EmporixCheckoutRequest,
  EmporixShipping,
} from '@/platform/integrations/emporix/model';
import type { CheckoutMapper } from '../CheckoutMapper';
import type { CheckoutAddress, CheckoutRequest, OrderShipping } from '../checkout';

//TODO create different Abstractions for CartCheckout and QuoteCheckout
@injectable('EmporixCheckoutMapper', 'Singleton')
class EmporixCheckoutMapper implements CheckoutMapper<EmporixCheckoutRequest> {
  mapToSource(_request: CheckoutRequest): EmporixCheckoutRequest {
    throw new Error('Not implemented');
  }

  mapToService(_source: EmporixCheckoutRequest): CheckoutRequest {
    throw new Error('Not implemented');
  }

  mapCartCheckoutToSource(
    request: CheckoutRequest,
    customer: EmporixCheckoutCustomer,
    paymentMethods: EmporixCheckoutPaymentMethod[],
  ): EmporixCartCheckoutRequest {
    const addresses = request.addresses.map((address) => ({
      ...address,
      contactName: address.contactName,
      contactPhone: address.contactPhone || '',
      type: address.type || 'SHIPPING',
    }));
    return {
      cartId: request.cartId,
      customer: customer,
      addresses: addresses,
      paymentMethods: paymentMethods,
      shipping: this.mapShippingToSource(request.shipping),
    };
  }

  // this should be its own Mapper
  mapShippingToSource(shipping: OrderShipping) {
    return {
      methodId: shipping.methodId,
      methodName: shipping.methodName,
      amount: shipping.amount,
      zoneId: shipping.zoneId,
      shippingTaxCode: shipping.taxCode,
    };
  }

  mapShippingFromSource(source: EmporixShipping): OrderShipping {
    return {
      methodId: source.methodId,
      methodName: source.methodName,
      amount: source.amount,
      zoneId: source.zoneId,
      taxCode: source.shippingTaxCode,
    };
  }

  // this should be its own Mapper
  mapAddressToSource(address: CheckoutAddress) {
    return {
      ...address,
      type: address.type,
    };
  }

  // this should be its own Mapper
  mapAddressFromSource(address: EmporixCheckoutAddress) {
    return {
      ...address,
    };
  }
}

export default EmporixCheckoutMapper;
