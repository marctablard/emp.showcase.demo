import { inject } from 'inversify';
import {
  applyInferredVariantAttributes,
  enrichProductsWithInferredVariantAttributes,
  inferVariantAttributes,
} from '@/lib/product/variant-name-parser';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixLabel } from '@/platform/integrations/emporix/model';
import type { EmporixProduct } from '@/platform/integrations/emporix/model/product';
import type { EmporixBrandApi } from '@/platform/integrations/emporix/product/EmporixBrandApi';
import type { EmporixLabelApi } from '@/platform/integrations/emporix/product/EmporixLabelApi';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { Paginated } from '@/platform/services/model/common';
import type { Product, ProductLabel } from '@/platform/services/model/product';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { CategoryService } from '../../category/CategoryService';
import type { Category } from '../../model/category';
import type { ProductPrice } from '../../model/price';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { PriceService } from '../../price';
import type SegmentFilterService from '../../search/impl/SegmentFilterService';
import type { SessionService } from '../../session/SessionService';

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
    @inject('CategoryService') private categoryService: CategoryService,
    @inject('SegmentFilterService') private segmentFilterService: SegmentFilterService,
    @inject('SessionService') private sessionService: SessionService,
  ) {}

  async getProductById(id: string, options?: ProductFetchOptions): Promise<Product | undefined> {
    const product = await this.productApi.getProduct(id);
    if (!product || !product.id) return undefined;

    // Filter by customer segments if requested
    if (options?.customerSegments) {
      const [filteredProduct] = await this.segmentFilterService.filterByCustomerSegments([product]);
      if (!filteredProduct) return undefined;
    }

    // Map the base product
    let mappedProduct = this.productMapper.mapToService(product);

    mappedProduct = await this.enrichProductVariantAttributes(mappedProduct);

    // Add additional data
    const [enhancedProduct] = await this.addAdditionalData([mappedProduct], options);

    return enhancedProduct;
  }

  private async fetchVariantItems(parentId: string, referenceProduct?: EmporixProduct): Promise<EmporixProduct[]> {
    const searchConfigs: Array<{ criteria: Record<string, string> }> = [
      { criteria: { id: `${parentId}-*` } },
      { criteria: { parentVariantId: parentId } },
      { criteria: { code: `${parentId}-*` } },
    ];

    if (referenceProduct?.name) {
      const nameValue =
        typeof referenceProduct.name === 'string'
          ? referenceProduct.name
          : referenceProduct.name.en || referenceProduct.name.de || Object.values(referenceProduct.name)[0];
      const namePrefix = nameValue?.split('/')?.[0];
      if (namePrefix) {
        searchConfigs.push({ criteria: { name: `~${namePrefix}/` } });
      }
    }

    const results = await Promise.all(
      searchConfigs.map((config) =>
        this.productApi
          .searchProducts({
            expand: ['parentVariant', 'template'],
            page: 0,
            size: 100,
            ...config,
          })
          .catch(() => ({ items: [] as EmporixProduct[] })),
      ),
    );

    for (const paginated of results) {
      const filtered = paginated.items.filter(
        (item: EmporixProduct) =>
          !!item.id &&
          (item.parentVariantId === parentId || item.id === parentId || item.id.startsWith(`${parentId}-`)),
      );
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return [];
  }

  private async enrichProductVariantAttributes(product: Product): Promise<Product> {
    if (product.variantAttributes && product.variantAttributes.length > 0) {
      return product;
    }

    if (product.productType === 'BASIC' || product.productType === 'BUNDLE') {
      return product;
    }

    if (
      product.productType &&
      product.productType !== 'DYNAMIC_VARIANT' &&
      product.productType !== 'VARIANT' &&
      product.productType !== 'PARENT_VARIANT'
    ) {
      return product;
    }

    if (!product.parentVariantId && !product.id.includes('-')) {
      return product;
    }

    const parentId = product.parentVariantId || product.id;
    const rawProduct = await this.productApi.getProduct(product.id);
    const siblings = await this.fetchVariantItems(parentId, rawProduct);
    if (siblings.length === 0) {
      return product;
    }

    const mappedSiblings = siblings.map((item) => this.productMapper.mapToService(item));
    const variantsForInference = mappedSiblings.some((item) => item.id === product.id)
      ? mappedSiblings
      : [product, ...mappedSiblings];
    const enrichedVariants = enrichProductsWithInferredVariantAttributes(variantsForInference, product.id);
    const currentProduct = enrichedVariants.find((item) => item.id === product.id);

    if (currentProduct?.variantAttributes?.length) {
      return currentProduct;
    }

    const { attributeDefinitions, attributeMaps } = inferVariantAttributes(variantsForInference, product.id);
    return applyInferredVariantAttributes(product, attributeDefinitions, attributeMaps);
  }

  async getVariantProducts(parentId: string, options?: ProductFetchOptions): Promise<Product[]> {
    const probe = await this.productApi.getProduct(parentId);
    const resolvedParentId = probe?.parentVariantId || parentId;
    let items = await this.fetchVariantItems(resolvedParentId, probe ?? undefined);

    if (items.length === 0 && resolvedParentId !== parentId) {
      items = await this.fetchVariantItems(parentId, probe ?? undefined);
    }

    // Filter by customer segments before mapping
    if (options?.customerSegments) {
      items = (await this.segmentFilterService.filterByCustomerSegments(items)) as EmporixProduct[];
    }

    // Map all variant products first
    const mappedProducts = items.map((product: EmporixProduct) => this.productMapper.mapToService(product));
    if (mappedProducts.length === 0) {
      return [];
    }

    const enrichedProducts = enrichProductsWithInferredVariantAttributes(mappedProducts);
    const parentProduct = await this.productApi.getProduct(resolvedParentId);
    if (parentProduct) {
      const mappedParent = this.productMapper.mapToService(parentProduct);
      const variantsForInference = mappedProducts.some((item) => item.id === mappedParent.id)
        ? mappedProducts
        : [mappedParent, ...mappedProducts];
      const { attributeDefinitions, attributeMaps } = inferVariantAttributes(variantsForInference);
      enrichedProducts.forEach((variant, index) => {
        enrichedProducts[index] = applyInferredVariantAttributes(variant, attributeDefinitions, attributeMaps);
      });

      if (!mappedParent.variantAttributes || mappedParent.variantAttributes.length === 0) {
        mappedParent.variantAttributes = attributeDefinitions.map((attribute) => ({
          ...attribute,
          values: attribute.values.map((value) => ({ ...value, selected: false })),
        }));
      }
    }

    return await this.addAdditionalData(enrichedProducts, options);
  }

  async getProducts(page?: number, pageSize?: number, options?: ProductFetchOptions): Promise<Paginated<Product>> {
    const paginated = await this.productApi.getProducts(page, pageSize);

    // Filter by customer segments before mapping
    let items: EmporixProduct[] = [];
    if (options?.customerSegments) {
      items = (await this.segmentFilterService.filterByCustomerSegments(
        paginated.items.filter((item: EmporixProduct) => !!item.id),
      )) as EmporixProduct[];
    } else {
      items = paginated.items;
    }
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
   * Adds additional data (brands, labels, categories, prices, variants) to mapped products
   * @param products The products to enhance
   * @param options Optional fetch options for including additional data
   * @returns Enhanced products with additional data
   */
  public async addAdditionalData(products: Product[], options?: ProductFetchOptions): Promise<Product[]> {
    // Get additional data (brands, labels, and categories)
    const { brandMap, labelMap, productCategoriesMap, priceMap, variantMap } = await this.getAdditionalData(
      products,
      options,
    );

    // Enhance each product with brand, label, and category information
    products.forEach((product: Product) => {
      // Add brand information
      if (product.brand) {
        const brand = brandMap.get(product.brand.id);
        if (brand) {
          product.brand = {
            id: brand.id,
            name: brand.name,
            logo: {
              url: brand.image,
              altText: brand.name,
            },
          };
        }
      }

      // Add label information
      if (product.labels && product.labels.length > 0) {
        product.labels = product.labels
          .map((label: ProductLabel) => labelMap.get(label.id))
          .filter((label?: EmporixLabel): label is EmporixLabel => Boolean(label))
          .map((label: EmporixLabel) => this.mapLabel(label));
      }

      // Add categories if available
      if (product.id) {
        const categories = productCategoriesMap.get(product.id);
        if (categories && categories.length > 0) {
          // currently theres no way to determine the primary Category, so we use the first
          // this is important for SEO so canonical URLs don't change when the product is
          // being browsed to from different Categories
          product.primaryCategory = categories[0];
          product.categories = categories;
        }
      }

      // Add price information if available
      if (product.id) {
        const price = priceMap.get(product.id);
        if (price) {
          product.price = price;
        }
      }

      // Add variant information if available
      if (product.id) {
        const variants = variantMap.get(product.id);
        if (variants) {
          product.variants = variants;
        }
      }
    });

    return products;
  }

  /**
   * Maps an Emporix Label to the internal ProductLabel format
   */
  private mapLabel(label: EmporixLabel): ProductLabel {
    return {
      id: label.id,
      name: label.name,
      image: label.image || label.cloudinaryUrl,
      description: label.description,
      overlay: label.overlay,
    };
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
    productCategoriesMap: Map<string, Category[]>;
    priceMap: Map<string, ProductPrice>;
    variantMap: Map<string, Product[]>;
  }> {
    // Collect all brand IDs and label IDs from products
    const brandIds = new Set<string>();
    const labelIds = new Set<string>();
    const productIds = new Set<string>();

    products.forEach((product: Product) => {
      if (product.brand) brandIds.add(product.brand.id);
      if (product.labels) product.labels.forEach((label: ProductLabel) => labelIds.add(label.id));
      if (product.id) productIds.add(product.id);
    });

    let sessionForProductPrices: Awaited<ReturnType<SessionService['getCurrent']>> | null = null;

    // Fetch all brands, labels, and categories in parallel
    const [brands, labels, productCategoriesArray, batchPriceMap, variantArray] = await Promise.all([
      Promise.all([...brandIds].map((id) => this.brandApi.getBrand(id))),
      Promise.all([...labelIds].map((id) => this.labelApi.getLabel(id))),
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
            return this.priceService.getProductPrices(ids, undefined, undefined, {
              siteCode: sessionForProductPrices.siteCode,
              currency: sessionForProductPrices.currency,
              country: sessionForProductPrices.country,
            });
          }
          return this.priceService.getProductPrices(ids);
        }
        return new Map<string, ProductPrice | null>();
      })(),
      Promise.all([...productIds].map((id) => (options?.variants ? this.getVariantProducts(id) : undefined))),
    ]);

    // Create lookup maps for brands and labels
    const brandMap = new Map<string, any>();
    brands.filter(Boolean).forEach((brand: any) => brand && brandMap.set(brand.id, brand));

    const labelMap = new Map<string, EmporixLabel>();
    labels.filter(Boolean).forEach((label: EmporixLabel) => label && labelMap.set(label.id, label));

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
    variantArray.filter(Boolean).forEach((variants: Product[]) => {
      if (!variants?.length) {
        return;
      }

      const parentKey = variants[0].parentVariantId || variants[0].id;
      variantMap.set(parentKey, variants);

      products.forEach((product) => {
        if (product.id === parentKey || product.parentVariantId === parentKey) {
          variantMap.set(product.id, variants);
        }
      });
    });

    return { brandMap, labelMap, productCategoriesMap, priceMap, variantMap };
  }
}

export default EmporixProductService;
