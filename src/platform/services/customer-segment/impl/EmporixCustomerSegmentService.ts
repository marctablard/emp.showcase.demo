import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerSegmentApi } from '@/platform/integrations/emporix/customer-segment/EmporixCustomerSegmentApi';
import type { SegmentResponse } from '@/platform/integrations/emporix/model';
import type { LoggerService } from '../../logger/LoggerService';
import type { CategoryTree, CustomerSegmentQueryOptions, ItemAssignment, Segment } from '../../model/customer-segment';
import type { CustomerSegmentMapper } from '../../model/customer-segment/CustomerSegmentMapper';
import type { Session } from '../../model/session/session';
import type { SessionService } from '../../session';
import type { CustomerSegmentService } from '../CustomerSegmentService';

/** Page size for `GET /segments/items` (no documented maximum for this service; probe used smaller pages). */
const SEGMENT_ITEMS_PAGE_SIZE = 200;
/** Hard cap on pages fetched by `getSegmentItems()` to protect against a runaway loop. */
const SEGMENT_ITEMS_MAX_PAGES = 50;
/** Page size for the `GET /segments` fallback. */
const SEGMENTS_FALLBACK_PAGE_SIZE = 100;
/** Hard cap on pages fetched by the `GET /segments` fallback. */
const SEGMENTS_FALLBACK_MAX_PAGES = 50;

type PagedItems<T> = { items: readonly T[]; totalCount: number };

/**
 * Walks `pageNumber` until `X-Total-Count` is reached, an empty page, or `maxPages`.
 * A short page alone does not stop the loop while the total says more items remain.
 */
async function collectPagedItems<T>(
  fetchPage: (pageNumber: number) => Promise<PagedItems<T>>,
  maxPages: number,
  onStop: (reason: 'cap' | 'truncated', collected: number, totalCount: number) => void,
): Promise<T[]> {
  const collected: T[] = [];
  let pageNumber = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (collected.length < totalCount) {
    if (pageNumber > maxPages) {
      onStop('cap', collected.length, totalCount);
      return collected;
    }
    const page = await fetchPage(pageNumber);
    totalCount = page.totalCount;
    collected.push(...page.items);
    if (page.items.length === 0) {
      break;
    }
    pageNumber += 1;
  }

  if (collected.length < totalCount) {
    onStop('truncated', collected.length, totalCount);
  }
  return collected;
}

type MySegmentsFallbackReason = 'unavailable' | 'shape-drift';
type SegmentInapplicabilityReason = 'status' | 'site' | 'validity';

@injectable('CustomerSegmentService', 'Singleton')
export class EmporixCustomerSegmentService implements CustomerSegmentService {
  constructor(
    @inject('EmporixCustomerSegmentApi') private readonly customerSegmentApi: EmporixCustomerSegmentApi,
    @inject('EmporixCustomerSegmentMapper') private readonly customerSegmentMapper: CustomerSegmentMapper,
    @inject('SessionService') private readonly sessionService: SessionService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async getMySegments(options?: { siteCode?: string }): Promise<Segment[]> {
    const session = await this.sessionService.getCurrent();
    const siteCode = options?.siteCode ?? session?.siteCode;
    const params = { legalEntityId: session?.legalEntityId, siteCode };

    try {
      const source = await this.resolveMySegmentsSource(params, session?.customerId);
      const now = Date.now();
      const mapped = source
        .map((segment) => this.customerSegmentMapper.mapSegment(segment))
        .filter((segment): segment is Segment => segment !== undefined);
      const applicable: Segment[] = [];
      const dropped: string[] = [];
      for (const segment of mapped) {
        const reason = this.getSegmentInapplicabilityReason(segment, siteCode, now);
        if (reason === undefined) {
          applicable.push(segment);
          continue;
        }
        dropped.push(segment.id);
        this.logger.debug(
          {
            segmentId: segment.id,
            reason,
            status: segment.status,
            segmentSiteCode: segment.siteCode,
            requestSiteCode: siteCode,
            validity: segment.validity,
          },
          'Customer segment not applicable; excluded from the products mode scope',
        );
      }
      this.logger.debug(
        { total: mapped.length, applicable: applicable.map((segment) => segment.id), dropped },
        'Resolved applicable customer segments',
      );
      return applicable;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          customerId: session?.customerId,
        },
        'Error fetching customer segments',
      );
      throw new Error(
        `Failed to retrieve customer segments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getSegmentItems(options?: CustomerSegmentQueryOptions): Promise<ItemAssignment[]> {
    const session = await this.sessionService.getCurrent();
    try {
      const baseParams: CustomerSegmentQueryOptions = {
        ...options,
        siteCode: options?.siteCode ?? session?.siteCode,
        legalEntityId: options?.legalEntityId ?? session?.legalEntityId,
        onlyActive: true,
        pageSize: SEGMENT_ITEMS_PAGE_SIZE,
      };

      return await collectPagedItems(
        async (pageNumber) => {
          const page = await this.customerSegmentApi.getSegmentItems({ ...baseParams, pageNumber });
          return {
            items: page.items.map((item) => this.customerSegmentMapper.mapToService(item)),
            totalCount: page.totalCount,
          };
        },
        SEGMENT_ITEMS_MAX_PAGES,
        (reason, collected, totalCount) => {
          if (reason === 'cap') {
            this.logger.warn(
              {
                siteCode: baseParams.siteCode,
                collected,
                totalCount,
                maxPages: SEGMENT_ITEMS_MAX_PAGES,
              },
              'Segment items pagination stopped at the hard page cap; result is truncated',
            );
            return;
          }
          this.logger.warn(
            { siteCode: baseParams.siteCode, collected, totalCount },
            'Segment items pagination ended before X-Total-Count was reached; result is truncated',
          );
        },
      );
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
        },
        'Error fetching customer segment items',
      );
      throw new Error(
        `Failed to retrieve customer segment items: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getCategoryTrees(options?: CustomerSegmentQueryOptions): Promise<CategoryTree[]> {
    const session = await this.sessionService.getCurrent();
    try {
      const response = await this.customerSegmentApi.getCategoryTrees({
        siteCode: options?.siteCode ?? session?.siteCode,
        legalEntityId: options?.legalEntityId ?? session?.legalEntityId,
      });

      return this.customerSegmentMapper.mapCategoryTrees(response);
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
        },
        'Error fetching customer segment category trees',
      );
      throw new Error(
        `Failed to retrieve customer segment category trees: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Primary `me/segments` when usable; otherwise every page of `GET /segments`. A fallback payload
   * with no string ids is treated as shape drift and thrown so `ProductsModeService` fails closed
   * (`assigned` / `segmentIds: []`) instead of granting the unsegmented catalog.
   */
  private async resolveMySegmentsSource(
    params: { legalEntityId?: string; siteCode?: string },
    customerId: string | undefined,
  ): Promise<SegmentResponse[]> {
    const primary = await this.customerSegmentApi.getMySegments(params);
    const fallbackReason = this.getMySegmentsFallbackReason(primary);
    if (fallbackReason === undefined) {
      return primary as SegmentResponse[];
    }

    this.logger.warn({ customerId, reason: fallbackReason }, 'me/segments unavailable; falling back to GET /segments');
    const source = await this.fetchFallbackSegments(params, customerId);
    if (this.getMySegmentsFallbackReason(source) === 'shape-drift') {
      this.logger.error(
        { customerId, reason: 'shape-drift' },
        'GET /segments fallback returned unusable payload; failing closed',
      );
      throw new Error('GET /segments fallback returned unusable payload');
    }
    return source;
  }

  private async fetchFallbackSegments(
    params: { legalEntityId?: string; siteCode?: string },
    customerId: string | undefined,
  ): Promise<SegmentResponse[]> {
    return collectPagedItems(
      (pageNumber) =>
        this.customerSegmentApi.getSegments({
          ...params,
          pageSize: SEGMENTS_FALLBACK_PAGE_SIZE,
          pageNumber,
        }),
      SEGMENTS_FALLBACK_MAX_PAGES,
      (reason, collected, totalCount) => {
        if (reason === 'cap') {
          this.logger.warn(
            { customerId, collected, totalCount, maxPages: SEGMENTS_FALLBACK_MAX_PAGES },
            'GET /segments fallback pagination stopped at the hard page cap; result is truncated',
          );
          return;
        }
        this.logger.warn(
          { customerId, collected, totalCount },
          'GET /segments fallback pagination ended before X-Total-Count was reached; result is truncated',
        );
      },
    );
  }

  /**
   * `null` means the endpoint answered without a JSON array (not deployed / non-ok). A non-empty
   * array in which no entry carries a string `id` is treated as shape drift so it cannot silently
   * turn into "no segments". An empty array is a legitimate "no segments" answer.
   */
  private getMySegmentsFallbackReason(primary: SegmentResponse[] | null): MySegmentsFallbackReason | undefined {
    if (primary === null) {
      return 'unavailable';
    }
    if (primary.length > 0 && !primary.some((entry) => typeof entry?.id === 'string')) {
      return 'shape-drift';
    }
    return undefined;
  }

  /**
   * The schema enum is `ACTIVE | INACTIVE`. A segment is excluded only when a non-`ACTIVE` status is
   * explicitly present; an absent status counts as applicable, because dropping segments widens the
   * catalog (the customer would resolve as `unsegmented`) — fail closed.
   * Returns the reason a segment is dropped (`undefined` = applicable) so the filter and the debug
   * diagnostics in `getMySegments` share one source of truth.
   */
  private getSegmentInapplicabilityReason(
    segment: Segment,
    siteCode: Session['siteCode'] | undefined,
    now: number,
  ): SegmentInapplicabilityReason | undefined {
    if (segment.status !== undefined && segment.status !== 'ACTIVE') {
      return 'status';
    }
    if (segment.siteCode !== undefined && segment.siteCode !== siteCode) {
      return 'site';
    }
    return this.isValidityContaining(segment.validity, now) ? undefined : 'validity';
  }

  /** Unparsable bounds are ignored rather than excluding the segment (excluding would widen the catalog). */
  private isValidityContaining(validity: Segment['validity'], now: number): boolean {
    if (!validity) {
      return true;
    }
    const from = validity.from ? Date.parse(validity.from) : Number.NaN;
    const to = validity.to ? Date.parse(validity.to) : Number.NaN;
    if (!Number.isNaN(from) && from > now) {
      return false;
    }
    if (!Number.isNaN(to) && to < now) {
      return false;
    }
    return true;
  }
}

export default EmporixCustomerSegmentService;
