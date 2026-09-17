import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixCouponValidationOutcome,
  EmporixCouponValidationRequest,
  EmporixCouponApi as IEmporixCouponApi,
} from '../EmporixCouponApi';

const createCouponMetrics = (route: string) => createFetchMetricsParams('coupon', route);

type CouponErrorBody = {
  type?: unknown;
  details?: unknown;
};

function readDetailTypes(details: unknown): string[] {
  if (!Array.isArray(details)) {
    return [];
  }
  return details.flatMap((detail) => {
    const type = detail && typeof detail === 'object' ? (detail as { type?: unknown }).type : undefined;
    return typeof type === 'string' ? [type] : [];
  });
}

@injectable('EmporixCouponApi', 'Singleton')
class EmporixCouponApi implements IEmporixCouponApi {
  constructor(
    @inject('EmporixApiInvoker') protected readonly apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
  ) {}

  async validateCoupon(code: string, request: EmporixCouponValidationRequest): Promise<EmporixCouponValidationOutcome> {
    const { orderTotal, legalEntityId, customerNumber } = request;
    const scopes = customerNumber
      ? ['coupon.coupon_redeem', 'coupon.coupon_redeem_on_behalf']
      : ['coupon.coupon_redeem'];
    const response = await this.apiClient.authenticatedFetch(
      `/coupon/${this.config.tenant}/coupons/${encodeURIComponent(code)}/validation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          orderTotal,
          discount: { amount: 0, currency: orderTotal.currency },
          ...(legalEntityId ? { legalEntityId } : {}),
          ...(customerNumber ? { customerNumber } : {}),
        }),
      },
      'service',
      { scopes },
      createCouponMetrics('/coupon/{tenant}/coupons/{code}/validation'),
    );

    if (response.ok) {
      return { ok: true };
    }
    if (response.status >= 500) {
      const errorDetails = await response.text();
      throw new Error(`Failed to validate coupon: ${response.status} ${response.statusText} ${errorDetails}`);
    }

    const body = (await response.json().catch(() => null)) as CouponErrorBody | null;
    return {
      ok: false,
      status: response.status,
      ...(typeof body?.type === 'string' ? { type: body.type } : {}),
      detailTypes: readDetailTypes(body?.details),
    };
  }
}

export default EmporixCouponApi;
