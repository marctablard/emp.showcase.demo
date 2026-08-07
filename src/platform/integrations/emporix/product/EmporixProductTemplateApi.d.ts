import type { EmporixPaginatedResponse, EmporixProductTemplateDefinition } from '../model';

export interface EmporixProductTemplateApi {
  /**
   * Retrieves a product template by id (optionally pinned to a version).
   * @link https://developer.emporix.io/api-references-1/readme/api-reference-27/product-templates
   */
  getProductTemplate(id: string, version?: string): Promise<EmporixProductTemplateDefinition | undefined>;

  /**
   * Retrieves a page of tenant product templates.
   * @link https://developer.emporix.io/api-references-1/readme/api-reference-27/product-templates
   */
  getProductTemplates(
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixProductTemplateDefinition>>;
}
