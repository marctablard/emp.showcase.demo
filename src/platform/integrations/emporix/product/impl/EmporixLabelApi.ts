import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixLabel,
  EmporixPaginatedResponse,
  EmporixSearchParams,
} from '@/platform/integrations/emporix/model';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixLabelApi as IEmporixLabelApi } from '../EmporixLabelApi';

/**
 * Implementation of LabelApi for Emporix label data.
 * Provides methods to retrieve label information from the Emporix API.
 */
@injectable('EmporixLabelApi', 'Singleton')
class EmporixLabelApi implements IEmporixLabelApi {
  constructor(@inject('EmporixApiInvoker') protected apiInvoker: EmporixApiInvoker) {}

  /**
   * Retrieves a list of all labels with pagination support.
   * @param page The page number to retrieve (0-based)
   * @param pageSize The number of labels per page
   * @param justOverlay If true, only returns labels with overlay.position >= 1
   * @returns A paginated response containing label data
   */
  async getLabels(
    page?: number,
    pageSize?: number,
    justOverlay?: boolean,
  ): Promise<EmporixPaginatedResponse<EmporixLabel>> {
    const params: EmporixSearchParams<EmporixLabel> = {
      page: page || 0,
      size: pageSize || 20,
    };

    const { query } = buildSearchQuery(params);
    let url = `/label/labels?${query}`;

    // Add justOverlay parameter if specified
    if (justOverlay !== undefined) {
      url += `&justOverlay=${justOverlay}`;
    }

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    return buildPaginatedResponse(params, response);
  }

  /**
   * Retrieves a specific label by its ID.
   * @param id The label ID to retrieve
   * @returns The label data or undefined if not found
   */
  async getLabel(id: string): Promise<EmporixLabel | undefined> {
    const response = await this.apiInvoker.authenticatedFetch(`/label/labels/${id}`, { method: 'GET' }, 'public');

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      } else {
        throw new Error(`Failed to get label: ${response.statusText}`);
      }
    }

    return await response.json();
  }
}

export default EmporixLabelApi;
