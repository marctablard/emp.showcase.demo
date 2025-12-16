import { EmporixLocalizedString, EmporixMetadata, EmporixPaginatedResponse } from './common';

/**
 * Emporix Catalog model
 * @link https://developer.emporix.io/docs/openapi/catalog/
 */
export interface EmporixCatalog {
  id: string;
  name: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  visibility: {
    visible: boolean;
    from: string;
    to: string;
  };
  publishedSites: string[];
  categoryIds: string[];
  status: 'VISIBLE' | 'NOT_VISIBLE';
  metadata?: EmporixMetadata;
}
