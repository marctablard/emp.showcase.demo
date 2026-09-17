import { inject } from 'inversify';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { isProductsModeOptIn } from '@/lib/common/products-mode-cookie';
import { injectable } from '@/platform/core/di/injectable';
import type { CustomerSegmentService } from '../../customer-segment/CustomerSegmentService';
import type { LoggerService } from '../../logger/LoggerService';
import type { Session } from '../../model/session/session';
import type { SearchService } from '../../search';
import BatteryIncludedSearchService from '../../search/impl/BatteryIncludedSearchService';
import type { SessionService } from '../../session';
import type {
  ProductsModeContext,
  ProductsModeResolveInput,
  ProductsModeService,
  SearchEngineKind,
} from '../ProductsModeService';

/** Trimmed site code; blank / undefined → `undefined` so a `?site=` of spaces never reaches upstream. */
function normalizeSiteCode(siteCode: string | undefined): string | undefined {
  const trimmed = siteCode?.trim();
  return trimmed || undefined;
}

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
   * Fail closed (Open Question 15): when the segment lookup rejects (`me/segments` unavailable,
   * shape-drifted, or thrown — `GET /segments` is not membership and is never used as a fallback)
   * the customer is treated as `assigned` with `segmentIds: []`. Consumers forward `segmentIds`
   * only in `assigned` mode, and the services treat `segmentIds === undefined` as unscoped but
   * `[]` as an empty scope (no results, no upstream call), so no out-of-segment product is
   * exposed during an outage.
   *
   * Session rule: the session is read with `getCurrentOrThrow()`. `undefined` (no session) is
   * `anonymous`; a failed session lookup is **not** — it rejects, so a logged-in customer during a
   * session/API outage can never be widened to the unscoped catalog. Callers already treat a
   * rejected `resolve()` as fail closed (SSR rethrows, routes answer a private `500`).
   *
   * Site rule: the request site is trimmed; when blank the validated session site is used (the
   * same source `EmporixProductService` uses). Segments are site-bound, so an authenticated
   * customer without any usable site cannot be matched against them — that also fails closed as
   * `assigned` / `segmentIds: []` (logged at `warn`) instead of resolving to an unscoped catalog.
   * An empty segment list from a successful lookup is not an error and yields `unsegmented`.
   * A non-empty lookup whose ids are all blank after trim is fail-closed (`assigned` / `[]`) so
   * BatteryIncluded cannot drop those values and send an unscoped visibility filter.
   */
  async resolve(input: ProductsModeResolveInput): Promise<ProductsModeContext> {
    let session: Session | undefined;
    try {
      session = await this.sessionService.getCurrentOrThrow();
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error) },
        'Session lookup failed; products mode cannot be resolved (fail closed, not anonymous)',
      );
      throw new Error(
        `Failed to resolve products mode: session lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    const siteCode = normalizeSiteCode(input.siteCode) ?? normalizeSiteCode(session?.siteCode);
    const customerId = session?.customerId;

    if (!isAuthenticatedSessionCustomerId(customerId)) {
      return this.buildContext('anonymous', [], false, siteCode);
    }

    if (siteCode === undefined) {
      this.logger.warn(
        { customerId },
        'No usable site for the segment lookup (request site blank, session without site); resolving products mode as assigned with no segments (fail closed)',
      );
      return this.buildContext('assigned', [], false, undefined, customerId);
    }

    let segmentIds: string[];
    try {
      const segments = await this.customerSegmentService.getMySegments({ siteCode });
      segmentIds = segments.map((segment) => segment.id.trim()).filter((id) => id.length > 0);
      if (segments.length > 0 && segmentIds.length === 0) {
        this.logger.warn(
          { customerId, siteCode },
          'Segment lookup returned no usable ids after normalize; resolving products mode as assigned with no segments (fail closed)',
        );
        return this.buildContext('assigned', [], false, siteCode, customerId);
      }
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
