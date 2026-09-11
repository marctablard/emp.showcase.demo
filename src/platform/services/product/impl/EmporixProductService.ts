import { inject } from 'inversify';
import { priceFetchOptionsFromSession } from '@/lib/common/price-match-session';
import { resolveProductLabelImageUrl } from '@/lib/common/product-label-image';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixLabel, EmporixProductTemplateDefinition } from '@/platform/integrations/emporix/model';
import type { EmporixProduct } from '@/platform/integrations/emporix/model/product';
import type { EmporixBrandApi } from '@/platform/integrations/emporix/product/EmporixBrandApi';
import type { EmporixLabelApi } from '@/platform/integrations/emporix/product/EmporixLabelApi';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { EmporixProductTemplateApi } from '@/platform/integrations/emporix/product/EmporixProductTemplateApi';
import type { LocalizedString, Paginated } from '@/platform/services/model/common';
import type { Product, ProductLabel, ProductTemplateAttributeType } from '@/platform/services/model/product';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { CategoryService } from '../../category/CategoryService';
import type { LoggerService } from '../../logger/LoggerService';
import type { Category } from '../../model/category';
import type { ProductPrice } from '../../model/price';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { PriceService } from '../../price';
import type SegmentFilterService from '../../search/impl/SegmentFilterService';
import type { SessionService } from '../../session/SessionService';

/** Page size for tenant label catalog fetch (`GET /label/labels`). */
const LABEL_CATALOG_PAGE_SIZE = 100;

/** Bound `q=id:(…)` chunks when resolving missing template refs for BI/list products. */
const TEMPLATE_REF_ID_CHUNK_SIZE = 50;

type ProductTemplateRef = { id: string; version?: string };

/**
 * `true` when the caller is segment-scoped but the scope is empty (COP-4822 fail closed, e.g. after
 * a failed segment lookup): `undefined` means unscoped, `[]` means nothing is visible.
 */
function isEmptySegmentScope(segmentIds: string[] | undefined): boolean {
  return segmentIds?.length === 0;
}

function templateCacheKey(id: string, version?: string): string {
  return version ? `${id}@${version}` : id;
}

function resolveTemplateVersionFromEmporix(template: EmporixProduct['template']): string | undefined {
  if (!template) {
    return undefined;
  }
  const version = template.version;
  if (typeof version === 'string' || typeof version === 'number') {
    return String(version);
  }
  const metadataVersion = template.metadata?.version;
  if (typeof metadataVersion === 'string' || typeof metadataVersion === 'number') {
    return String(metadataVersion);
  }
  return undefined;
}

/**
 * Implementation of ProductService for Emporix product data.
 * Maps between Emporix API product format and internal Product model.
 */
@injectable('EmporixProductService', 'Singleton')
class EmporixProductService implements ProductService {
  constructor(
    @inject('PriceService') private priceService: PriceService,
    @inject('EmporixProductMapper') private productMapper: ProductMapper<EmporixProduct>,
    @inject('EmporixProductApi') private productApi: EmporixProductApi,
    @inject('EmporixBrandApi') private brandApi: EmporixBrandApi,
    @inject('EmporixLabelApi') private labelApi: EmporixLabelApi,
    @inject('EmporixProductTemplateApi') private readonly productTemplateApi: EmporixProductTemplateApi,
    @inject('CategoryService') private categoryService: CategoryService,
    @inject('SegmentFilterService') private segmentFilterService: SegmentFilterService,
    @inject('SessionService') private sessionService: SessionService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async getProductById(id: string, options?: ProductFetchOptions): Promise<Product | undefined> {
    // Empty segment scope: nothing is visible, so the lookup is a miss without any upstream call (COP-4822).
    if (isEmptySegmentScope(options?.segmentIds)) return undefined;

    const product = await this.productApi.getProduct(id);
    if (!product || !product.id) return undefined;

    if (options?.segmentIds !== undefined) {
      const inScope = await this.filterIdsInSegmentScope([product.id]);
      if (!inScope.has(product.id)) return undefined;
    }

    // Map the base product
    const mappedProduct = this.productMapper.mapToService(product);

    // Add additional data
    const [enhancedProduct] = await this.addAdditionalData([mappedProduct], options);

    return enhancedProduct;
  }

  async getVariantProducts(parentId: string, options?: ProductFetchOptions): Promise<Product[]> {
    if (isEmptySegmentScope(options?.segmentIds)) return [];

    const paginated = await this.productApi.searchProducts({
      expand: ['parentVariant', 'template'],
      criteria: { parentVariantId: parentId },
      page: 0,
      size: 100,
    });

    const items = await this.applySegmentScope(paginated.items, options);

    // Map all variant products first
    const mappedProducts = items.map((product: EmporixProduct) => this.productMapper.mapToService(product));
    if (mappedProducts.length > 0) {
      return await this.addAdditionalData(mappedProducts, options);
    } else {
      return [];
    }
  }

  async getProducts(page?: number, pageSize?: number, options?: ProductFetchOptions): Promise<Paginated<Product>> {
    const paginated = await this.productApi.getProducts(page, pageSize);

    const items = await this.applySegmentScope(paginated.items, options);
    const mappedProducts: Product[] = items.map((product: EmporixProduct) => this.productMapper.mapToService(product));

    // Add additional data to all products
    const enhancedProducts = await this.addAdditionalData(mappedProducts, options);

    return {
      items: enhancedProducts,
      page: paginated.page,
      pageSize: paginated.size,
      total: paginated.total,
    };
  }

  /**
   * Keeps only the products inside the customer's segment scope when `options.segmentIds` is set
   * (fail closed). `undefined` leaves the items untouched; `[]` is an empty scope and drops every
   * item without an upstream membership call.
   */
  private async applySegmentScope(items: EmporixProduct[], options?: ProductFetchOptions): Promise<EmporixProduct[]> {
    if (options?.segmentIds === undefined) {
      return items;
    }
    if (isEmptySegmentScope(options.segmentIds)) {
      return [];
    }
    const withIds = items.filter((item: EmporixProduct) => !!item.id);
    const inScope = await this.filterIdsInSegmentScope(withIds.map((item) => item.id as string));
    return withIds.filter((item) => inScope.has(item.id as string));
  }

  /**
   * Segment membership for the session site — the same site authority this service already uses
   * for prices. Without a session site nothing can be proven in scope, so the result is empty.
   */
  private async filterIdsInSegmentScope(ids: string[]): Promise<Set<string>> {
    const session = await this.sessionService.getCurrent();
    const siteCode = session?.siteCode;
    if (!siteCode) {
      this.logger.warn({ ids: ids.length }, 'Segment scope requested without a session site; failing closed');
      return new Set();
    }
    return this.segmentFilterService.filterProductIdsInScope(ids, siteCode);
  }

  /**
   * Adds additional data (brands, labels, categories, prices, variants) to mapped products
   * @param products The products to enhance
   * @param options Optional fetch options for including additional data
   * @returns Enhanced products with additional data
   */
  public async addAdditionalData(products: Product[], options?: ProductFetchOptions): Promise<Product[]> {
    // BI/search hits often carry templateAttributes without template.id — resolve refs first.
    await this.resolveMissingTemplateRefs(products);

    // Get additional data (brands, labels, templates, and categories)
    const { brandMap, labelMap, templateMap, productCategoriesMap, priceMap, variantMap } =
      await this.getAdditionalData(products, options);

    // Enhance each product with brand, label, template labels, and category information
    products.forEach((product: Product) => {
      this.applyAdditionalDataToProduct(product, {
        brandMap,
        labelMap,
        templateMap,
        productCategoriesMap,
        priceMap,
        variantMap,
      });
    });

    return products;
  }

  private applyAdditionalDataToProduct(
    product: Product,
    maps: {
      brandMap: Map<string, { id: string; name: string; image?: string }>;
      labelMap: Map<string, EmporixLabel>;
      templateMap: Map<string, EmporixProductTemplateDefinition>;
      productCategoriesMap: Map<string, Category[]>;
      priceMap: Map<string, ProductPrice>;
      variantMap: Map<string, Product[]>;
    },
  ): void {
    this.applyBrandToProduct(product, maps.brandMap);
    this.applyLabelsToProduct(product, maps.labelMap);
    this.applyTemplateMetaToProduct(product, maps.templateMap);
    this.applyIdBoundDataToProduct(product, maps);
    const templateRef = product.template;
    product.variants?.forEach((variant) => {
      this.applyTemplateMetaToProduct(variant, maps.templateMap, templateRef);
    });
  }

  private applyBrandToProduct(
    product: Product,
    brandMap: Map<string, { id: string; name: string; image?: string }>,
  ): void {
    if (!product.brand) {
      return;
    }
    const brand = brandMap.get(product.brand.id);
    if (!brand) {
      return;
    }
    product.brand = {
      id: brand.id,
      name: brand.name,
      logo: {
        url: brand.image ?? '',
        altText: brand.name,
      },
    };
  }

  private applyLabelsToProduct(product: Product, labelMap: Map<string, EmporixLabel>): void {
    if (!product.labels?.length) {
      return;
    }
    product.labels = product.labels
      .map((label: ProductLabel) => labelMap.get(label.id))
      .filter((label?: EmporixLabel): label is EmporixLabel => Boolean(label))
      .map((label: EmporixLabel) => this.mapLabel(label));
  }

  private applyTemplateMetaToProduct(
    product: Product,
    templateMap: Map<string, EmporixProductTemplateDefinition>,
    fallbackTemplate?: Product['template'],
  ): void {
    const templateRef = product.template?.id ? product.template : fallbackTemplate;
    if (!templateRef?.id) {
      return;
    }
    if (!product.template?.id && fallbackTemplate) {
      product.template = fallbackTemplate;
    }
    const template =
      templateMap.get(templateCacheKey(templateRef.id, templateRef.version)) ?? templateMap.get(templateRef.id);
    if (!template) {
      return;
    }
    product.templateAttributeLabels = this.mapTemplateAttributeLabels(template);
    product.templateAttributeTypes = this.mapTemplateAttributeTypes(template);
    product.templateAttributeOrder = this.mapTemplateAttributeOrder(template);
    if (!product.variantAttributes?.length) {
      return;
    }
    product.variantAttributes = product.variantAttributes.map((attr) => {
      const label = product.templateAttributeLabels?.[attr.key];
      return label ? { ...attr, name: label } : attr;
    });
  }

  private productNeedsTemplateRef(product: Product): boolean {
    if (!product.id || product.template?.id) {
      return false;
    }
    if (product.templateAttributes && Object.keys(product.templateAttributes).length > 0) {
      return true;
    }
    if (product.variantAttributes && product.variantAttributes.length > 0) {
      return true;
    }
    return Boolean(product.isParentVariant || product.parentVariantId);
  }

  private collectProductsNeedingTemplateRefs(products: Product[]): Product[] {
    return products.filter((product) => this.productNeedsTemplateRef(product));
  }

  private indexTemplateRefFromSearchItem(
    item: EmporixProduct,
    templateByProductId: Map<string, ProductTemplateRef>,
  ): void {
    const rawTemplate = item.template?.id ? item.template : item.parentVariant?.template;
    if (!item.id || !rawTemplate?.id) {
      return;
    }
    const version = resolveTemplateVersionFromEmporix(rawTemplate);
    const ref: ProductTemplateRef = {
      id: rawTemplate.id,
      ...(version ? { version } : {}),
    };
    templateByProductId.set(item.id, ref);
    if (item.parentVariantId) {
      templateByProductId.set(item.parentVariantId, ref);
    }
  }

  private applyResolvedTemplateRefs(products: Product[], templateByProductId: Map<string, ProductTemplateRef>): void {
    for (const product of products) {
      const ref =
        templateByProductId.get(product.id) ??
        (product.parentVariantId ? templateByProductId.get(product.parentVariantId) : undefined);
      if (ref) {
        product.template = ref;
      }
    }
  }

  /**
   * Battery Included (and similar) mappers often omit `template.id`.
   * Resolve refs via product search `expand=template`, then Templates API can supply labels/types.
   */
  private async resolveMissingTemplateRefs(products: Product[]): Promise<void> {
    const needingRefs = this.collectProductsNeedingTemplateRefs(products);
    if (needingRefs.length === 0) {
      return;
    }

    const ids = [
      ...new Set(needingRefs.flatMap((product) => [product.id, product.parentVariantId].filter(Boolean) as string[])),
    ];
    const templateByProductId = new Map<string, ProductTemplateRef>();

    for (let offset = 0; offset < ids.length; offset += TEMPLATE_REF_ID_CHUNK_SIZE) {
      const chunk = ids.slice(offset, offset + TEMPLATE_REF_ID_CHUNK_SIZE);
      try {
        const response = await this.productApi.searchProducts({
          page: 0,
          size: chunk.length,
          criteria: { id: `(${chunk.join(',')})` },
          expand: ['template', 'parentVariant'],
        });
        for (const item of response.items ?? []) {
          this.indexTemplateRefFromSearchItem(item, templateByProductId);
        }
      } catch (error) {
        this.logger.error(
          { err: error, chunkSize: chunk.length },
          'Failed to resolve product template refs; continuing without them',
        );
      }
    }

    this.applyResolvedTemplateRefs(needingRefs, templateByProductId);
  }

  private applyIdBoundDataToProduct(
    product: Product,
    maps: {
      productCategoriesMap: Map<string, Category[]>;
      priceMap: Map<string, ProductPrice>;
      variantMap: Map<string, Product[]>;
    },
  ): void {
    if (!product.id) {
      return;
    }
    const categories = maps.productCategoriesMap.get(product.id);
    if (categories && categories.length > 0) {
      // currently theres no way to determine the primary Category, so we use the first
      // this is important for SEO so canonical URLs don't change when the product is
      // being browsed to from different Categories
      product.primaryCategory = categories[0];
      product.categories = categories;
    }
    const price = maps.priceMap.get(product.id);
    if (price) {
      product.price = price;
    }
    const variants = maps.variantMap.get(product.id);
    if (variants) {
      product.variants = variants;
    }
  }

  private mapTemplateAttributeLabels(template: EmporixProductTemplateDefinition): Record<string, LocalizedString> {
    const labels: Record<string, LocalizedString> = {};
    for (const attribute of template.attributes ?? []) {
      if (attribute.key && attribute.name) {
        labels[attribute.key] = attribute.name;
      }
    }
    return labels;
  }

  private mapTemplateAttributeTypes(
    template: EmporixProductTemplateDefinition,
  ): Record<string, ProductTemplateAttributeType> {
    const types: Record<string, ProductTemplateAttributeType> = {};
    for (const attribute of template.attributes ?? []) {
      if (
        attribute.key &&
        (attribute.type === 'TEXT' ||
          attribute.type === 'NUMBER' ||
          attribute.type === 'BOOLEAN' ||
          attribute.type === 'DATETIME')
      ) {
        types[attribute.key] = attribute.type;
      }
    }
    return types;
  }

  /** Preserve Product Templates `attributes[]` order for PLP/PDP display. */
  private mapTemplateAttributeOrder(template: EmporixProductTemplateDefinition): string[] {
    const order: string[] = [];
    for (const attribute of template.attributes ?? []) {
      if (attribute.key) {
        order.push(attribute.key);
      }
    }
    return order;
  }

  private async fetchProductTemplates(
    refs: Array<{ id: string; version?: string }>,
  ): Promise<Map<string, EmporixProductTemplateDefinition>> {
    const templateMap = new Map<string, EmporixProductTemplateDefinition>();
    if (refs.length === 0) {
      return templateMap;
    }

    const unique = new Map<string, { id: string; version?: string }>();
    for (const ref of refs) {
      unique.set(templateCacheKey(ref.id, ref.version), ref);
    }

    const fetched = await Promise.all(
      [...unique.values()].map(async (ref) => {
        const template = await this.productTemplateApi.getProductTemplate(ref.id, ref.version);
        return { ref, template };
      }),
    );

    for (const { ref, template } of fetched) {
      if (!template) {
        continue;
      }
      templateMap.set(templateCacheKey(ref.id, ref.version), template);
      templateMap.set(ref.id, template);
    }

    return templateMap;
  }

  /**
   * Maps an Emporix Label to the internal ProductLabel format
   */
  private mapLabel(label: EmporixLabel): ProductLabel {
    return {
      id: label.id,
      name: label.name,
      // Prefer absolute `image` URL; never treat `cloudinaryUrl` storage path as an img src.
      image: resolveProductLabelImageUrl(label.image),
      description: label.description,
      overlay: label.overlay,
    };
  }

  /**
   * Resolves catalog page total for label pagination, or `'break'` when the catalog is exhausted.
   */
  private resolveLabelCatalogTotal(response: { items: EmporixLabel[]; total: number }, page: number): number | 'break' {
    if (response.total >= 0) {
      return response.total;
    }
    if (response.items.length === 0) {
      return 'break';
    }
    const hasMorePage = response.items.length < LABEL_CATALOG_PAGE_SIZE ? 0 : 1;
    return (page + 1) * LABEL_CATALOG_PAGE_SIZE + hasMorePage;
  }

  /** Fetches any requested label IDs still missing after the catalog scan. */
  private async mergeMissingLabelsById(labelIds: Set<string>, labelMap: Map<string, EmporixLabel>): Promise<void> {
    const missingIds = [...labelIds].filter((id) => !labelMap.has(id));
    if (missingIds.length === 0) {
      return;
    }
    const missingLabels = await Promise.all(missingIds.map((id) => this.labelApi.getLabel(id)));
    for (const label of missingLabels) {
      if (label) {
        labelMap.set(label.id, label);
      }
    }
  }

  /**
   * Loads needed labels from the tenant catalog (`GET /label/labels`) with pagination,
   * then falls back to per-id GET for any IDs still missing.
   */
  private async fetchLabelsByIds(labelIds: Set<string>): Promise<Map<string, EmporixLabel>> {
    const labelMap = new Map<string, EmporixLabel>();
    if (labelIds.size === 0) {
      return labelMap;
    }

    let page = 0;
    let total = Number.POSITIVE_INFINITY;

    while (labelMap.size < labelIds.size && page * LABEL_CATALOG_PAGE_SIZE < total) {
      const response = await this.labelApi.getLabels(page, LABEL_CATALOG_PAGE_SIZE);
      const resolvedTotal = this.resolveLabelCatalogTotal(response, page);
      if (resolvedTotal === 'break') {
        break;
      }
      total = resolvedTotal;

      for (const label of response.items) {
        if (labelIds.has(label.id)) {
          labelMap.set(label.id, label);
        }
      }

      if (response.items.length < LABEL_CATALOG_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    await this.mergeMissingLabelsById(labelIds, labelMap);

    return labelMap;
  }

  /**
   * Fetches additional data (brands, labels, and categories) for products
   * @param products The products to fetch additional data for
   * @returns Maps of brands, labels, and product categories
   */
  private async getAdditionalData(
    products: Product[],
    options?: ProductFetchOptions,
  ): Promise<{
    brandMap: Map<string, any>;
    labelMap: Map<string, EmporixLabel>;
    templateMap: Map<string, EmporixProductTemplateDefinition>;
    productCategoriesMap: Map<string, Category[]>;
    priceMap: Map<string, ProductPrice>;
    variantMap: Map<string, Product[]>;
  }> {
    // Collect all brand IDs, label IDs, template refs, and product IDs
    const brandIds = new Set<string>();
    const labelIds = new Set<string>();
    const templateRefs: Array<{ id: string; version?: string }> = [];
    const productIds = new Set<string>();

    const collectTemplateRef = (product: Product): void => {
      if (product.template?.id) {
        templateRefs.push({ id: product.template.id, version: product.template.version });
      }
    };

    products.forEach((product: Product) => {
      if (product.brand) brandIds.add(product.brand.id);
      if (product.labels) product.labels.forEach((label: ProductLabel) => labelIds.add(label.id));
      // Always fetch the Templates API definition. `expand=template` often echoes the
      // attribute key into `attributes[].name` instead of the MD localized label.
      collectTemplateRef(product);
      product.variants?.forEach(collectTemplateRef);
      if (product.id) productIds.add(product.id);
    });

    let sessionForProductPrices: Awaited<ReturnType<SessionService['getCurrent']>> | null = null;

    // Fetch brands, labels, product templates, and categories in parallel
    const [brands, labelMap, templateMap, productCategoriesArray, batchPriceMap, variantArray] = await Promise.all([
      Promise.all([...brandIds].map((id) => this.brandApi.getBrand(id))),
      this.fetchLabelsByIds(labelIds),
      this.fetchProductTemplates(templateRefs),
      Promise.all(
        [...productIds].map((id) =>
          options?.categories ? this.categoryService.getCategoriesForProduct(id, true) : undefined,
        ),
      ),
      (async () => {
        const ids = [...productIds];
        if (typeof options?.prices === 'object' && options.prices !== null) {
          return this.priceService.getProductPrices(ids, undefined, undefined, options.prices);
        } else if (options?.prices === true) {
          sessionForProductPrices = await this.sessionService.getCurrent();
          if (sessionForProductPrices) {
            return this.priceService.getProductPrices(
              ids,
              undefined,
              undefined,
              priceFetchOptionsFromSession(sessionForProductPrices) ?? {
                siteCode: sessionForProductPrices.siteCode,
                currency: sessionForProductPrices.currency,
                country: sessionForProductPrices.country,
                useFallback: false,
              },
            );
          }
          return this.priceService.getProductPrices(ids);
        }
        return new Map<string, ProductPrice | null>();
      })(),
      // Forward ONLY `segmentIds`: passing the full options would re-enter variant/price enrichment per variant.
      options?.variants
        ? Promise.all([...productIds].map((id) => this.getVariantProducts(id, { segmentIds: options.segmentIds })))
        : Promise.resolve<Product[][]>([]),
    ]);

    // Create lookup maps for brands
    const brandMap = new Map<string, any>();
    brands.filter(Boolean).forEach((brand: any) => brand && brandMap.set(brand.id, brand));

    // Create lookup map for product categories
    const productCategoriesMap = new Map<string, Category[]>();
    if (options?.categories) {
      [...productIds].forEach((productId, index) => {
        productCategoriesMap.set(productId, productCategoriesArray[index] || []);
      });
    } else {
      [...productIds].forEach((productId) => {
        productCategoriesMap.set(productId, []);
      });
    }

    const priceMap = new Map<string, ProductPrice>();
    batchPriceMap.forEach((price: ProductPrice | null, productId: string) => {
      if (!price) {
        return;
      }
      if (sessionForProductPrices && price.currency !== sessionForProductPrices.currency) {
        return;
      }
      priceMap.set(productId, price);
    });

    const variantMap = new Map<string, Product[]>();
    variantArray
      .filter(Boolean)
      .forEach(
        (variants: Product[]) =>
          variants?.length > 0 && variants[0].parentVariantId && variantMap.set(variants[0].parentVariantId, variants),
      );

    return { brandMap, labelMap, templateMap, productCategoriesMap, priceMap, variantMap };
  }
}

export default EmporixProductService;
