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

type MySegmentsFallbackReason = 'unavailable' | 'shape-drift';

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
      const primary = await this.customerSegmentApi.getMySegments(params);
      const fallbackReason = this.getMySegmentsFallbackReason(primary);

      let source: SegmentResponse[];
      if (fallbackReason === undefined) {
        source = primary as SegmentResponse[];
      } else {
        this.logger.warn(
          { customerId: session?.customerId, reason: fallbackReason },
          'me/segments unavailable; falling back to GET /segments',
        );
        source = await this.customerSegmentApi.getSegments({ ...params, pageSize: SEGMENTS_FALLBACK_PAGE_SIZE });
      }

      const now = Date.now();
      return source
        .map((segment) => this.customerSegmentMapper.mapSegment(segment))
        .filter((segment): segment is Segment => segment !== undefined)
        .filter((segment) => this.isSegmentApplicable(segment, siteCode, now));
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

      const collected: ItemAssignment[] = [];
      let pageNumber = 1;
      let totalCount = Number.POSITIVE_INFINITY;

      // Pages while `X-Total-Count` says more items remain (a short page alone does not stop it).
      while (collected.length < totalCount) {
        if (pageNumber > SEGMENT_ITEMS_MAX_PAGES) {
          this.logger.warn(
            {
              siteCode: baseParams.siteCode,
              collected: collected.length,
              totalCount,
              maxPages: SEGMENT_ITEMS_MAX_PAGES,
            },
            'Segment items pagination stopped at the hard page cap; result is truncated',
          );
          return collected;
        }

        const page = await this.customerSegmentApi.getSegmentItems({ ...baseParams, pageNumber });
        totalCount = page.totalCount;
        collected.push(...page.items.map((item) => this.customerSegmentMapper.mapToService(item)));

        // Non-advancing guard: an empty page can never reach `totalCount`, so stop instead of spinning.
        if (page.items.length === 0) {
          break;
        }
        pageNumber += 1;
      }

      if (collected.length < totalCount) {
        this.logger.warn(
          { siteCode: baseParams.siteCode, collected: collected.length, totalCount },
          'Segment items pagination ended before X-Total-Count was reached; result is truncated',
        );
      }

      return collected;
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
   */
  private isSegmentApplicable(segment: Segment, siteCode: Session['siteCode'] | undefined, now: number): boolean {
    if (segment.status !== undefined && segment.status !== 'ACTIVE') {
      return false;
    }
    if (segment.siteCode !== undefined && segment.siteCode !== siteCode) {
      return false;
    }
    return this.isValidityContaining(segment.validity, now);
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
