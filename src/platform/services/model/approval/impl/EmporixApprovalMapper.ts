import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { EmporixCheckoutPaymentMethod } from '@/platform/integrations/emporix/model';
//TODO remove all the redundant types
import {
  EmporixApprovalCreateRequest,
  EmporixApprovalDeliveryWindow,
  EmporixApprovalDetails,
  EmporixApprovalPayment,
  EmporixApprovalPrice,
  EmporixApprovalRequestor,
  EmporixApprovalResource,
  EmporixApprovalResourceItem,
  EmporixApprovalResponse,
  EmporixApprovalTaxablePrice,
  EmporixApprovalUser,
} from '@/platform/integrations/emporix/model/approval';
import type { EmporixPaymentGatewayApi } from '@/platform/integrations/emporix/payment/EmporixPaymentGatewayApi';
import {
  Approval,
  ApprovalCreateRequest,
  ApprovalDeliveryWindow,
  ApprovalDetails,
  ApprovalPayment,
  ApprovalPrice,
  ApprovalRequestor,
  ApprovalResource,
  ApprovalResourceItem,
  ApprovalTaxablePrice,
  ApprovalUser,
} from '@/platform/services/model/approval';
import { CheckoutPaymentMethod } from '../../checkout';
import EmporixCheckoutMapper from '../../checkout/impl/EmporixCheckoutMapper';
import EmporixAddressMapper from '../../common/impl/EmporixAddressMapper';
import { ApprovalMapper } from '../ApprovalMapper';

/**
 * Implementation of ApprovalMapper for Emporix approval data.
 * Maps between Emporix API approval format and internal Approval model.
 */
@injectable('EmporixApprovalMapper', 'Singleton')
export class EmporixApprovalMapper implements ApprovalMapper<EmporixApprovalResponse> {
  constructor(
    @inject('EmporixPaymentGatewayApi') private paymentApi: EmporixPaymentGatewayApi,
    @inject('EmporixAddressMapper') private readonly addressMapper: EmporixAddressMapper,
    @inject('EmporixCheckoutMapper') private readonly checkoutMapper: EmporixCheckoutMapper,
  ) {}

  /**
   * Maps an Emporix approval to the internal Approval model.
   *
   * @param source - The Emporix approval data
   * @returns The internal Approval model
   */
  mapToService(source: EmporixApprovalResponse): Approval {
    return {
      id: source.id,
      resourceType: source.resourceType,
      action: source.action,
      status: source.status,
      resource: this.mapResource(source.resource),
      requestor: this.mapRequestor(source.requestor),
      approver: this.mapUser(source.approver),
      comment: source.comment,
      approverComment: source.approverComment,
      expiryDate: source.expiryDate,
      createdAt: source.metadata.createdAt!,
      updatedAt: source.metadata.updatedAt,
      details: source.details ? this.mapDetails(source.details) : undefined,
      version: source.metadata.version,
    };
  }

  /**
   * Maps an internal Approval model back to Emporix approval format.
   * Note: This is primarily used for creating/updating approvals.
   *
   * @param service - The internal Approval model
   * @returns The Emporix approval data
   */
  mapToSource(service: Approval): EmporixApprovalResponse {
    return {
      id: service.id,
      resourceType: service.resourceType,
      action: service.action,
      status: service.status,
      resource: this.mapResourceToSource(service.resource),
      requestor: this.mapRequestorToSource(service.requestor),
      approver: this.mapUserToSource(service.approver),
      comment: service.comment,
      approverComment: service.approverComment,
      expiryDate: service.expiryDate,
      details: service.details ? this.mapDetailsToSource(service.details) : undefined,
      metadata: {
        version: service.version,
      },
    };
  }

  /**
   * Maps an approval create request from service to integration layer
   *
   * @param service - The service layer create request
   * @returns The integration layer create request
   */
  mapCreateRequestToSource(service: ApprovalCreateRequest): EmporixApprovalCreateRequest {
    return {
      id: service.id,
      resourceType: service.resourceType,
      resourceId: service.resourceId,
      action: service.action,
      approver: {
        userId: service.approver.userId!,
      },
      comment: service.comment,
      details: service.details ? this.mapDetailsToSource(service.details) : undefined,
    };
  }

  /**
   * Helper methods for mapping between integration and service models
   */
  private mapUser(source: EmporixApprovalUser): ApprovalUser {
    return {
      userId: source.userId,
      firstName: source.firstName,
      lastName: source.lastName,
      fullName: `${source.firstName} ${source.lastName}`,
    };
  }

  private mapRequestor(source: EmporixApprovalRequestor): ApprovalRequestor {
    return {
      userId: source.userId,
      firstName: source.firstName,
      lastName: source.lastName,
      fullName: `${source.firstName} ${source.lastName}`,
      email: source.email,
    };
  }

  private mapUserToSource(service: ApprovalUser): EmporixApprovalUser {
    return {
      userId: service.userId,
      firstName: service.firstName,
      lastName: service.lastName,
    };
  }

  private mapRequestorToSource(service: ApprovalRequestor): EmporixApprovalRequestor {
    return {
      userId: service.userId,
      firstName: service.firstName,
      lastName: service.lastName,
      email: service.email,
    };
  }

  private mapPrice(source: EmporixApprovalPrice): ApprovalPrice {
    return {
      currency: source.currency,
      amount: source.amount,
      formattedAmount: `${source.amount.toFixed(2)} ${source.currency}`,
    };
  }

  private mapPriceToSource(service: ApprovalPrice): EmporixApprovalPrice {
    return {
      currency: service.currency,
      amount: service.amount,
    };
  }

  private mapTaxablePrice(source: EmporixApprovalTaxablePrice): ApprovalTaxablePrice {
    return {
      currency: source.currency,
      netValue: source.netValue,
      grossValue: source.grossValue,
      taxValue: source.taxValue,
      formattedNetValue: `${source.netValue.toFixed(2)} ${source.currency}`,
      formattedGrossValue: `${source.grossValue.toFixed(2)} ${source.currency}`,
      formattedTaxValue: `${source.taxValue.toFixed(2)} ${source.currency}`,
    };
  }

  private mapTaxablePriceToSource(service: ApprovalTaxablePrice): EmporixApprovalTaxablePrice {
    return {
      currency: service.currency,
      netValue: service.netValue,
      grossValue: service.grossValue,
      taxValue: service.taxValue,
    };
  }

  private mapDeliveryWindow(source: EmporixApprovalDeliveryWindow): ApprovalDeliveryWindow {
    return {
      id: source.id,
      slotId: source.slotId,
      deliveryDate: source.deliveryDate,
      formattedDeliveryDate: new Date(source.deliveryDate).toLocaleDateString(),
    };
  }

  private mapDeliveryWindowToSource(service: ApprovalDeliveryWindow): EmporixApprovalDeliveryWindow {
    return {
      id: service.id,
      slotId: service.slotId,
      deliveryDate: service.deliveryDate,
    };
  }

  private mapResourceItem(source: EmporixApprovalResourceItem): ApprovalResourceItem {
    // Extract product ID from YRN if available
    let productId: string | undefined;
    if (source.itemYrn) {
      const parts = source.itemYrn.split(';');
      if (parts.length > 1) {
        productId = parts[parts.length - 1];
      }
    }

    return {
      quantity: source.quantity,
      itemPrice: this.mapPrice(source.itemPrice),
      itemYrn: source.itemYrn,
      productId,
    };
  }

  private mapResourceItemToSource(service: ApprovalResourceItem): EmporixApprovalResourceItem {
    return {
      quantity: service.quantity,
      itemPrice: this.mapPriceToSource(service.itemPrice),
      itemYrn: service.itemYrn,
    };
  }

  private mapResource(source: EmporixApprovalResource): ApprovalResource {
    return {
      id: source.id,
      items: source.items?.map((item) => this.mapResourceItem(item)),
      totalPrice: source.totalPrice ? this.mapPrice(source.totalPrice) : undefined,
      subTotalPrice: source.subTotalPrice ? this.mapPrice(source.subTotalPrice) : undefined,
      subtotalAggregate: source.subtotalAggregate ? this.mapTaxablePrice(source.subtotalAggregate) : undefined,
      amount: source.amount,
      siteCode: source.siteCode,
      deliveryWindow: source.deliveryWindow ? this.mapDeliveryWindow(source.deliveryWindow) : undefined,
    };
  }

  private mapResourceToSource(service: ApprovalResource): EmporixApprovalResource {
    return {
      id: service.id,
      items: service.items?.map((item) => this.mapResourceItemToSource(item)),
      totalPrice: service.totalPrice ? this.mapPriceToSource(service.totalPrice) : undefined,
      subTotalPrice: service.subTotalPrice ? this.mapPriceToSource(service.subTotalPrice) : undefined,
      subtotalAggregate: service.subtotalAggregate
        ? this.mapTaxablePriceToSource(service.subtotalAggregate)
        : undefined,
      amount: service.amount,
      siteCode: service.siteCode,
      deliveryWindow: service.deliveryWindow ? this.mapDeliveryWindowToSource(service.deliveryWindow) : undefined,
    };
  }

  private mapPaymentMethod(
    source: EmporixCheckoutPaymentMethod,
    source2?: EmporixApprovalPayment,
  ): CheckoutPaymentMethod {
    return {
      provider: source.provider,
      active: true,
      customAttributes: source.customAttributes,
      id: source2?.paymentId || '',
      code: source.method,
      amount: source.amount,
    };
  }

  private mapPaymentMethodToSource(service: CheckoutPaymentMethod): EmporixCheckoutPaymentMethod {
    return {
      provider: service.provider,
      customAttributes: service.customAttributes,
      method: service.code,
      amount: service.amount,
    };
  }

  private mapPayment(source: EmporixApprovalPayment): ApprovalPayment {
    return {
      paymentId: source.paymentId,
      customAttributes: source.customAttributes,
    };
  }

  private mapPaymentToSource(service: CheckoutPaymentMethod): EmporixApprovalPayment {
    return {
      paymentId: service.id,
      customAttributes: service.customAttributes,
    };
  }

  private mapDetails(source: EmporixApprovalDetails): ApprovalDetails {
    return {
      currency: source.currency,
      paymentMethods: source.paymentMethods?.map((method) => this.mapPaymentMethod(method, source.payment)),
      shipping: source.shipping ? this.checkoutMapper.mapShippingFromSource(source.shipping) : undefined,
      payment: source.payment ? this.mapPayment(source.payment) : undefined,
      addresses: source.addresses?.map((address) => this.checkoutMapper.mapAddressToSource(address)),
    };
  }

  private mapDetailsToSource(service: ApprovalDetails): EmporixApprovalDetails {
    return {
      currency: service.currency,
      paymentMethods: service.paymentMethods?.map((method) => this.mapPaymentMethodToSource(method)),
      shipping: service.shipping ? this.checkoutMapper.mapShippingToSource(service.shipping) : undefined,
      payment: service.paymentMethods?.length ? this.mapPaymentToSource(service.paymentMethods[0]) : undefined,
      addresses: service.addresses?.map((address) => this.checkoutMapper.mapAddressToSource(address)),
    };
  }
}

export default EmporixApprovalMapper;
