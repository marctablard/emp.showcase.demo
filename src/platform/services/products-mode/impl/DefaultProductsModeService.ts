import { inject } from 'inversify';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { isProductsModeOptIn } from '@/lib/common/products-mode-cookie';
import { injectable } from '@/platform/core/di/injectable';
import type { CustomerSegmentService } from '../../customer-segment/CustomerSegmentService';
import type { LoggerService } from '../../logger/LoggerService';
import type { SearchService } from '../../search';
import BatteryIncludedSearchService from '../../search/impl/BatteryIncludedSearchService';
import type { SessionService } from '../../session';
import type {
  ProductsModeContext,
  ProductsModeResolveInput,
  ProductsModeService,
  SearchEngineKind,
} from '../ProductsModeService';

/**
 * Default `ProductsModeService`: resolves the products mode from the session identity, the
 * customer's active segments, the public `NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE` flag and the
 * opt-in cookie value supplied by the caller. The bound search engine is reported in the context
 * for consumers but does not gate ALL PRODUCTS MODE — the mode is engine-agnostic.
 *
 * Singleton — no per-request state; the flag is parsed once in the constructor.
 */
@injectable('ProductsModeService', 'Singleton')
class DefaultProductsModeService implements ProductsModeService {
  private readonly allProductsModeAllowed: boolean;
  private readonly engine: SearchEngineKind;

  constructor(
    @inject('SessionService') private readonly sessionService: SessionService,
    @inject('CustomerSegmentService') private readonly customerSegmentService: CustomerSegmentService,
    @inject('SearchService') searchService: SearchService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {
    this.allProductsModeAllowed = process.env.NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE === 'true';
    // Same engine detection as `src/lib/ssr/search-engine.ts`; the binding is fixed at build time.
    this.engine = searchService instanceof BatteryIncludedSearchService ? 'batteryincluded' : 'emporix';
  }

  /**
   * Resolves the products mode for the current request.
   *
   * Identity rule: only an authenticated session customer id (non-empty and not the Emporix
   * anonymous-session literal `ANONYMOUS`, see `isAuthenticatedSessionCustomerId`) triggers a
   * segment lookup; every other session resolves to `anonymous` without calling upstream.
   *
   * Hard rule: the client can never override the mode. `optInCookieValue` is only honoured when
   * `canToggleAllProducts` is true (flag on, segmented customer — on every search engine) and the
   * value is bound to the current customer id; with the flag off the cookie is ignored entirely.
   * localStorage / query params are never consulted.
   *
   * Fail closed (Open Question 15): when the segment lookup rejects (primary `me/segments` and the
   * `GET /segments` fallback both failed) the customer is treated as `assigned` with
   * `segmentIds: []`. Consumers forward `segmentIds` only in `assigned` mode, and the services treat
   * `segmentIds === undefined` as unscoped but `[]` as an empty scope (no results, no upstream
   * call), so no out-of-segment product is exposed during an outage.
   * An empty segment list from a successful lookup is not an error and yields `unsegmented`.
   */
  async resolve(input: ProductsModeResolveInput): Promise<ProductsModeContext> {
    const session = await this.sessionService.getCurrent();
    const siteCode = input.siteCode ?? session?.siteCode;
    const customerId = session?.customerId;

    if (!isAuthenticatedSessionCustomerId(customerId)) {
      return this.buildContext('anonymous', [], false, siteCode);
    }

    let segmentIds: string[];
    try {
      const segments = await this.customerSegmentService.getMySegments({ siteCode });
      segmentIds = segments.map((segment) => segment.id);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error), customerId },
        'Segment lookup failed; resolving products mode as assigned with no segments (fail closed)',
      );
      return this.buildContext('assigned', [], false, siteCode, customerId);
    }

    if (segmentIds.length === 0) {
      return this.buildContext('unsegmented', [], false, siteCode, customerId);
    }

    const canToggleAllProducts = this.allProductsModeAllowed;
    const mode = canToggleAllProducts && isProductsModeOptIn(input.optInCookieValue, customerId) ? 'all' : 'assigned';

    return this.buildContext(mode, segmentIds, canToggleAllProducts, siteCode, customerId);
  }

  private buildContext(
    mode: ProductsModeContext['mode'],
    segmentIds: string[],
    canToggleAllProducts: boolean,
    siteCode: string | undefined,
    customerId?: string,
  ): ProductsModeContext {
    return { mode, segmentIds, canToggleAllProducts, engine: this.engine, siteCode, customerId };
  }
}

export default DefaultProductsModeService;
