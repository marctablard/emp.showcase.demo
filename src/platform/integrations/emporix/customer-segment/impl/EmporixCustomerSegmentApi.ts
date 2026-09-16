import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  CategoryTreeItemResponse,
  CustomerSegmentQueryParams,
  ItemAssignmentPageResponse,
  ItemAssignmentResponse,
  SegmentPageResponse,
  SegmentResponse,
} from '../../model';
import type { EmporixCustomerSegmentApi as IEmporixCustomerSegmentApi } from '../EmporixCustomerSegmentApi';

const createCustomerSegmentMetrics = (route: string) => createFetchMetricsParams('customer-segment', route);

const MY_SEGMENTS_ROUTE = '/customer-segment/{tenant}/me/segments';
const SEGMENTS_ROUTE = '/customer-segment/{tenant}/segments';
const SEGMENT_ITEMS_ROUTE = '/customer-segment/{tenant}/segments/items';
const CATEGORY_TREES_ROUTE = '/customer-segment/{tenant}/segments/items/category-trees';

/** The count header is opt-in on Emporix list endpoints (precedent: `EmporixCategoryApi`). */
const TOTAL_COUNT_HEADER = 'X-Total-Count';

@injectable('EmporixCustomerSegmentApi', 'Singleton')
class EmporixCustomerSegmentApi implements IEmporixCustomerSegmentApi {
  constructor(
    @inject('EmporixApiInvoker') protected readonly apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  /**
   * Feature-detecting call to `me/segments` (COP-5908). A non-JSON-array outcome
   * (unknown `me/*` route, empty body, missing content-type) resolves `null` so the
   * service can fail closed — `GET /segments` is not customer membership.
   */
  async getMySegments(params?: CustomerSegmentQueryParams): Promise<SegmentResponse[] | null> {
    const url = this.buildUrl('/me/segments', params);

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
      },
      'session',
      undefined,
      createCustomerSegmentMetrics(MY_SEGMENTS_ROUTE),
    );

    if (!response.ok) {
      this.logger.debug(
        { status: response.status, route: MY_SEGMENTS_ROUTE },
        'me/segments unavailable: non-ok status',
      );
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('json')) {
      this.logger.debug(
        { status: response.status, contentType, route: MY_SEGMENTS_ROUTE },
        'me/segments unavailable: response is not JSON',
      );
      return null;
    }

    const body = await response.text();
    if (!body) {
      this.logger.debug({ status: response.status, route: MY_SEGMENTS_ROUTE }, 'me/segments unavailable: empty body');
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      this.logger.debug({ err, route: MY_SEGMENTS_ROUTE }, 'me/segments unavailable: body is not valid JSON');
      return null;
    }

    if (!Array.isArray(parsed)) {
      this.logger.debug(
        { bodyType: typeof parsed, route: MY_SEGMENTS_ROUTE },
        'me/segments unavailable: body is not a JSON array',
      );
      return null;
    }

    return parsed as SegmentResponse[];
  }

  async getSegments(params?: CustomerSegmentQueryParams): Promise<SegmentPageResponse> {
    const url = this.buildUrl('/segments', params);

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: { [TOTAL_COUNT_HEADER]: 'true' },
      },
      'session',
      undefined,
      createCustomerSegmentMetrics(SEGMENTS_ROUTE),
    );
    if (!response.ok) {
      throw new Error(`Failed to retrieve customer segments: ${response.statusText}`);
    }

    return this.readTotalCountedPage<SegmentResponse>(response, SEGMENTS_ROUTE, params?.pageNumber);
  }

  async getSegmentItems(params?: CustomerSegmentQueryParams): Promise<ItemAssignmentPageResponse> {
    const url = this.buildUrl('/segments/items', params);

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: { [TOTAL_COUNT_HEADER]: 'true' },
      },
      'session',
      undefined,
      createCustomerSegmentMetrics(SEGMENT_ITEMS_ROUTE),
    );
    if (!response.ok) {
      throw new Error(`Failed to retrieve customer segment items: ${response.statusText}`);
    }

    return this.readTotalCountedPage<ItemAssignmentResponse>(response, SEGMENT_ITEMS_ROUTE, params?.pageNumber);
  }

  async getCategoryTrees(params?: CustomerSegmentQueryParams): Promise<CategoryTreeItemResponse[]> {
    const url = this.buildUrl('/segments/items/category-trees', params);

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
      },
      'session',
      undefined,
      createCustomerSegmentMetrics(CATEGORY_TREES_ROUTE),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve customer segment category trees: ${response.statusText}`);
    }

    return response.json();
  }

  private buildUrl(path: string, params?: CustomerSegmentQueryParams): string {
    const queryString = this.buildQueryString(params);
    const querySuffix = queryString ? `?${queryString}` : '';
    return `/customer-segment/${this.config.tenant}${path}${querySuffix}`;
  }

  private async readTotalCountedPage<T>(
    response: Response,
    route: string,
    pageNumber: number | undefined,
  ): Promise<{ items: T[]; totalCount: number }> {
    const items = (await response.json()) as T[];
    const totalCount = this.parseTotalCount(response.headers.get(TOTAL_COUNT_HEADER));
    if (totalCount === undefined) {
      this.logger.error({ route, itemCount: items.length, pageNumber }, 'X-Total-Count header missing; failing closed');
      throw new Error('X-Total-Count header missing');
    }
    return { items, totalCount };
  }

  private parseTotalCount(headerValue: string | null): number | undefined {
    if (headerValue === null || headerValue.trim() === '') {
      return undefined;
    }
    const parsed = Number.parseInt(headerValue, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Serialises the query params in a fixed order. Truthy string/number params are appended
   * (falsy values such as `''` / `0` are skipped, as before); `onlyActive` is appended whenever it is
   * defined, as `'true'` / `'false'`.
   */
  private buildQueryString(params?: CustomerSegmentQueryParams): string {
    const queryParams = new URLSearchParams();
    if (!params) {
      return '';
    }

    const truthyParams: Array<[key: string, value: string | number | undefined]> = [
      ['q', params.q],
      ['pageSize', params.pageSize],
      ['pageNumber', params.pageNumber],
      ['sort', params.sort],
      ['fields', params.fields],
      ['legalEntityId', params.legalEntityId],
      ['siteCode', params.siteCode],
    ];
    for (const [key, value] of truthyParams) {
      if (value) {
        queryParams.append(key, value.toString());
      }
    }
    if (params.onlyActive !== undefined) {
      queryParams.append('onlyActive', params.onlyActive ? 'true' : 'false');
    }
    return queryParams.toString();
  }
}

export default EmporixCustomerSegmentApi;
