'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Copy, FlipHorizontal2, Share2, Sun } from 'lucide-react';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { ProductCarousel } from '@/components/product/product-carousel';
import { TemplateAttributeValue } from '@/components/product/template-attribute-value';
import { BulletPoint } from '@/components/ui/bullet-point';
import { Card, CardContent } from '@/components/ui/card';
import { EnergyBadge } from '@/components/ui/energy-badge';
import { Separator } from '@/components/ui/separator';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { WishlistPinButton } from '@/components/wishlist/wishlist-pin-button';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import { useLogger } from '@/hooks/common/useLogger';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useComparisonToggle } from '@/hooks/comparison/useComparisonToggle';
import { useValidateAddToComparison } from '@/hooks/comparison/useValidateAddToComparison';
import { usePdpCurrentProduct } from '@/hooks/product/usePdpCurrentProduct';
import { usePdpPurchaseData } from '@/hooks/product/usePdpPurchaseData';
import { usePdpShippingCost } from '@/hooks/product/usePdpShippingCost';
import { usePdpStickyAtcVisibility } from '@/hooks/product/usePdpStickyAtcVisibility';
import { useProduct } from '@/hooks/product/useProduct';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { isEnergyEfficiencyClass } from '@/lib/common/energy-efficiency';
import {
  PDP_TECHNICAL_INFORMATION_SECTION_ID,
  applyPdpAnchorScrollMargin,
  getPdpTechnicalInformationHref,
  scrollToPdpAnchor,
} from '@/lib/common/pdp-sections';
import {
  KEY_SPEC_BASIC_GROUP_ID,
  type KeySpecificationGroup,
  TECHNICAL_INFO_BASIC_GROUP_ID,
  getKeySpecificationGroups,
  getTechnicalInformationGroups,
  hasLocalizedHighlights,
  hasTechnicalInformation,
} from '@/lib/common/product-content';
import { parseBooleanTemplateAttributeValue } from '@/lib/common/product-template-attributes';
import { isVariantFamilyProduct } from '@/lib/common/product-variant-attributes';
import type { L10nInput } from '@/lib/l10n';
import { resolveCatalogDisplayName } from '@/lib/product/resolve-catalog-display-name';
import { isVariantConfiguratorProduct } from '@/lib/product/variant-configurator';
import { cn } from '@/lib/utils';
import type { LocalizedString, StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { GroupedSpecification, Product, ProductSpecification } from '@/platform/services/model/product';
import type { Session } from '@/platform/services/model/session/session';
import type { ProductFetchOptions } from '@/platform/services/product';
import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';
import { Button } from '../ui/button';
import { H1, H2, Overline } from '../ui/h';
import { Spinner } from '../ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ProductAddToCart from './product-add-to-cart';
import ProductAddToCartBar from './product-add-to-cart-bar';
import { ProductDescription } from './product-description';
import { ProductDetailRecommendations } from './product-detail-recommendations';
import { ProductLabels } from './product-labels';
import { ProductPriceComponent, ProductPriceSkeleton, ProductPriceUnavailable } from './product-price';
import { ProductShippingInfo } from './product-shipping-info';
import { ProductTierPrices } from './product-tier-prices';
import ProductVariantSelector from './product-variant-selector';
import { RelatedMaterials } from './related-materials';

export interface ProductDetailProps {
  product?: Product | string;
  options: ProductFetchOptions;
  className?: string;
  /** Server-resolved catalog identity (locale + site default). H1 uses this when present. */
  catalogDisplayName?: string;
}

function PdpPriceBlock({
  price,
  quantity,
}: Readonly<{ price: ProductPrice | null | undefined; quantity: number }>): React.ReactElement {
  if (price === undefined) {
    return <ProductPriceSkeleton />;
  }
  if (price === null) {
    return <ProductPriceUnavailable />;
  }
  return <ProductPriceComponent price={price} quantity={quantity} />;
}

function PdpBrandName({ name }: Readonly<{ name: string }>): React.ReactElement {
  // Follow-up: dedicated brand-listing route missing — brand-filtered PLP
  // `/browse?filters[brand.name][]=…` probe returned 0 hits for Victron Energy
  // (2026-08-06); keep the name non-interactive to avoid a dead empty-result link (D10).
  return <span>{name}</span>;
}

function PdpBrand({
  name,
  logoUrl,
}: Readonly<{
  name?: string;
  logoUrl?: string;
}>): React.ReactElement | null {
  const trimmedLogoUrl = logoUrl?.trim();

  if (!trimmedLogoUrl && !name) {
    return null;
  }

  return (
    <Overline className="flex items-center gap-2 text-sm">
      {trimmedLogoUrl ? (
        <Image
          src={trimmedLogoUrl}
          alt={name ?? ''}
          height={32}
          width={32}
          className="object-contain"
          data-testid="product-brand-logo"
          // Brand assets are often SVG (no file extension on Cloudinary). Next/Image
          // optimizer rejects SVG → blank logo; serve the origin URL instead.
          unoptimized
        />
      ) : null}
      {name ? <PdpBrandName name={name} /> : null}
    </Overline>
  );
}

function resolveKeySpecLabel(spec: ProductSpecification, l10n: (value: L10nInput) => string): string {
  return l10n(spec.label);
}

function resolveKeySpecGroupLabel(
  group: KeySpecificationGroup,
  t: ReturnType<typeof useTranslations<'product'>>,
  l10n: (value: L10nInput) => string,
): string {
  if (group.id === KEY_SPEC_BASIC_GROUP_ID) {
    return t('basicSpecifications');
  }
  if (group.groupName) {
    return l10n(group.groupName).trim();
  }
  return '';
}

async function copyProductItemNumber(
  productId: string,
  copiedTitle: string,
  logError: (context: { error: string; productId: string }, message: string) => void,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(productId);
    notify({
      title: copiedTitle,
      type: ToastType.Success,
      duration: 1000,
    });
  } catch (error) {
    logError(
      { error: error instanceof Error ? error.message : String(error), productId },
      'Failed to copy item number to clipboard',
    );
  }
}

function resolvePdpDeliveryDays(availability: StockAvailability | undefined): [number, number] {
  if (availability?.isAvailable) {
    return [0, 0];
  }
  const days = availability?.availableInDays || 1;
  return [days, days + 2];
}

function hasProductLabels(product: Product): boolean {
  return Boolean(product.labels?.length);
}

function resolveTechnicalGroupTitle(
  groupName: string | LocalizedString,
  l10n: (value: L10nInput) => string,
  t: ReturnType<typeof useTranslations<'product'>>,
): string {
  if (groupName === TECHNICAL_INFO_BASIC_GROUP_ID) {
    return t('basicAttributes');
  }
  return l10n(groupName);
}

function resolveTechnicalItemLabel(label: string | LocalizedString, l10n: (value: L10nInput) => string): string {
  return l10n(label);
}

function PdpTechnicalInformation({
  groups,
  className,
  l10n,
  t,
  title,
  templateAttributeTypes,
}: Readonly<{
  groups: GroupedSpecification[];
  className?: string;
  l10n: (value: L10nInput) => string;
  t: ReturnType<typeof useTranslations<'product'>>;
  title: string;
  templateAttributeTypes?: Product['templateAttributeTypes'];
}>): React.ReactElement {
  const locale = useLocale();
  const sectionRef = useRef<HTMLDivElement>(null);

  // Keep scroll-margin aligned with sticky header + ATC bar (heights change on scroll/resize).
  useEffect(() => {
    const syncMargin = (): void => {
      applyPdpAnchorScrollMargin(sectionRef.current);
    };
    syncMargin();
    window.addEventListener('resize', syncMargin);
    window.addEventListener('scroll', syncMargin, { passive: true });
    return () => {
      window.removeEventListener('resize', syncMargin);
      window.removeEventListener('scroll', syncMargin);
    };
  }, []);

  return (
    <div id={PDP_TECHNICAL_INFORMATION_SECTION_ID} ref={sectionRef} className={cn(className, 'mb-12')}>
      <Overline className="mb-6 text-sm">{title}</Overline>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((spec: GroupedSpecification, groupIndex) => {
          const groupTitle = resolveTechnicalGroupTitle(spec.groupName, l10n, t);
          return (
            <Card
              key={`${groupTitle}-${groupIndex}`}
              variant="default"
              rounded="lg"
              shadow="none"
              className="gap-0 overflow-hidden border border-border-primary p-0"
            >
              <p className="border-b border-border-primary bg-surface-disabled px-4 py-3 text-sm font-headlines font-bold">
                {groupTitle}
              </p>
              <dl>
                {spec.item.map((i) => {
                  const itemLabel = resolveTechnicalItemLabel(i.label, l10n);
                  const unit = typeof i.unit === 'string' ? i.unit.trim() : l10n(i.unit).trim();
                  const rawValue = l10n(i.value);
                  const attributeType = i.attributeKey ? templateAttributeTypes?.[i.attributeKey] : undefined;
                  return (
                    <div
                      className="grid grid-cols-2 gap-3 border-b border-border-primary px-4 py-3 text-sm last:border-b-0"
                      key={itemLabel}
                    >
                      <dt className="min-w-0 wrap-break-word text-text-placeholders">{itemLabel}</dt>
                      <dd className="flex min-w-0 items-center gap-1 wrap-break-word font-medium text-text-headings">
                        {i.attributeKey ? (
                          <TemplateAttributeValue value={rawValue} type={attributeType} locale={locale} />
                        ) : (
                          rawValue
                        )}
                        {unit ? ` ${unit}` : ''}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PdpGallery({
  product,
  l10nOrEmpty,
  unlabeledAltWithId,
}: Readonly<{
  product: Product;
  l10nOrEmpty: (value: L10nInput) => string;
  unlabeledAltWithId: (id: string) => string;
}>): React.ReactElement {
  const images = product.images;

  let media: React.ReactNode;
  if (!images || images.length === 0) {
    media = (
      <div className="bg-surface-image-background flex aspect-square items-center justify-center">
        <Image src={'/images/no_image_alt.png'} alt={l10nOrEmpty(product.name) || ''} width={90} height={90} />
      </div>
    );
  } else if (images.length === 1) {
    media = (
      <div className="relative aspect-square">
        <Image
          src={images[0].url}
          alt={
            images[0].altText
              ? l10nOrEmpty(images[0].altText) || l10nOrEmpty(product.name) || unlabeledAltWithId(product.id)
              : l10nOrEmpty(product.name) || unlabeledAltWithId(product.id)
          }
          fill
          className="object-contain object-center"
        />
      </div>
    );
  } else {
    media = <ProductCarousel images={images} />;
  }

  return (
    <Card variant="gray" rounded="lg" className="p-4 md:p-6">
      <CardContent className="px-0">
        <div className="overflow-hidden">{media}</div>
      </CardContent>
    </Card>
  );
}

function renderKeySpecValue(
  spec: ProductSpecification,
  l10n: (value: L10nInput) => string,
  locale: string,
  templateAttributeTypes?: Product['templateAttributeTypes'],
): React.ReactNode {
  const rawValue = l10n(spec.value).trim();
  const unit = spec.unit ? l10n(spec.unit).trim() : '';
  const attributeKey = spec.key.startsWith('template-') ? spec.key.slice('template-'.length) : undefined;
  const attributeType = attributeKey ? templateAttributeTypes?.[attributeKey] : undefined;

  if (isEnergyEfficiencyClass(rawValue)) {
    return (
      <span className="flex items-center gap-1.5">
        <EnergyBadge rating={rawValue} />
        {unit ? <span className="font-normal text-base">{unit}</span> : null}
      </span>
    );
  }

  if (attributeKey) {
    const isBoolean = parseBooleanTemplateAttributeValue(rawValue, attributeType) !== undefined;
    return (
      <span className="inline-flex items-center gap-1.5">
        <TemplateAttributeValue value={rawValue} type={attributeType} locale={locale} />
        {unit && !isBoolean ? <span className="font-normal text-base">{unit}</span> : null}
      </span>
    );
  }

  return unit ? `${rawValue} ${unit}` : rawValue;
}

function PdpKeySpecsCard({
  product,
  keySpecGroups,
  l10n,
  t,
  onCopyItemNumber,
}: Readonly<{
  product: Product;
  keySpecGroups: KeySpecificationGroup[];
  l10n: (value: L10nInput) => string;
  t: ReturnType<typeof useTranslations<'product'>>;
  onCopyItemNumber: () => void;
}>): React.ReactElement | null {
  const locale = useLocale();
  const hasSpecs = keySpecGroups.some((group) => group.items.length > 0);
  const showGroupHeaders = keySpecGroups.length > 1;

  if (!hasSpecs && !hasTechnicalInformation(product)) {
    return null;
  }

  return (
    <Card
      variant="default"
      rounded="lg"
      shadow="none"
      className="border border-border-primary bg-surface-page p-4 md:p-6 gap-4"
    >
      <CardContent className="p-0">
        {hasSpecs ? (
          <>
            <H2 variant="h6" className="mb-4 text-base font-headlines">
              {t('keySpecs')}
            </H2>
            <div className="flex flex-col gap-5">
              {keySpecGroups.map((group) => {
                const groupLabel = resolveKeySpecGroupLabel(group, t, l10n);
                return (
                  <div key={group.id} className="flex flex-col gap-3" data-testid="product-key-spec-group">
                    {showGroupHeaders && groupLabel ? (
                      <div className="flex items-center gap-3">
                        <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-text-headings">
                          {groupLabel}
                        </p>
                        <Separator className="min-w-0 flex-1" />
                      </div>
                    ) : null}
                    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                      {group.items.map((spec: ProductSpecification) => (
                        <div key={spec.key} className="min-w-0">
                          <dt className="text-xs uppercase tracking-wide text-text-placeholders">
                            {resolveKeySpecLabel(spec, l10n)}
                          </dt>
                          <dd className="mt-0.5 text-sm font-medium text-text-headings">
                            {renderKeySpecValue(spec, l10n, locale, product.templateAttributeTypes)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {hasTechnicalInformation(product) ? (
          <a
            href={getPdpTechnicalInformationHref()}
            onClick={(event) => {
              event.preventDefault();
              scrollToPdpAnchor(PDP_TECHNICAL_INFORMATION_SECTION_ID);
            }}
            className="mt-5 inline-block text-sm font-medium text-text-action hover:text-text-action-hover"
          >
            {t('more')}
          </a>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-primary pt-4">
          <span className="text-xs uppercase tracking-wide text-text-placeholders">{t('itemNumber')}</span>
          <span className="inline-flex items-center gap-2 rounded border border-border-primary bg-surface-disabled px-3 py-1.5 text-sm font-medium text-text-headings">
            <span className="break-all">{product.id}</span>
            <button
              type="button"
              onClick={onCopyItemNumber}
              aria-label={t('copy')}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded text-text-placeholders outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PdpHighlights({
  product,
  locale,
  title,
}: Readonly<{
  product: Product;
  locale: string;
  title: string;
}>): React.ReactElement | null {
  if (!hasLocalizedHighlights(product, locale)) {
    return null;
  }

  return (
    <div className="border-t border-border-primary pt-6">
      <H2 variant="h6" className="mb-4 text-base font-headlines text-text-action">
        {title}
      </H2>
      <div className="space-y-3">
        {(product.highlights?.[locale] ?? []).map((highlight) => (
          <BulletPoint key={highlight} label={highlight} iconColor="primary" variant="default" size="lg" icon={Sun} />
        ))}
      </div>
    </div>
  );
}

interface PdpDetailViewProps {
  product: Product;
  ssrSeedProduct?: Product;
  className?: string;
  session: Session | null | undefined;
  catalogDisplayName?: string;
}

function PdpDetailView({
  product,
  ssrSeedProduct,
  className,
  session,
  catalogDisplayName,
}: Readonly<PdpDetailViewProps>): React.ReactElement {
  const locale = useLocale();
  const { site } = useSite();
  const headingName = catalogDisplayName ?? resolveCatalogDisplayName(product.name, locale, site?.defaultLanguage);
  const { l10n, l10nOrEmpty } = useL10n(locale);
  const t = useTranslations('product');
  const logger = useLogger();
  const isAboveMediumScreen = useBreakpoint('md');
  const { isInComparison, toggle: toggleComparison } = useComparisonToggle();
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(product);
  const addToCartButton = useRef<HTMLDivElement>(null);
  const addToCartBar = useRef<HTMLDivElement>(null);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();
  const [quantity, setQuantity] = useState(1);
  const { price, availability } = usePdpPurchaseData(product, session, site, quantity);
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(product, price, 'wishlist');
  const { shippingCost, postalCode: shippingPostalCode } = usePdpShippingCost(price, quantity);
  const stickyAtcVisible = usePdpStickyAtcVisibility(
    addToCartButton,
    isAboveMediumScreen && !isVariantConfiguratorProduct(product),
  );
  const showLabels = hasProductLabels(product);
  const showTierPrices = price != null && (price.tierValues?.length ?? 0) > 1;
  const deliveryDays = resolvePdpDeliveryDays(availability);
  const keySpecGroups = getKeySpecificationGroups(product);
  const technicalInfoGroups = getTechnicalInformationGroups(product);
  const compareActive = isInComparison(product.id);
  const relatedItems = product.relatedItems?.length ? product.relatedItems : ssrSeedProduct?.relatedItems;
  const showVariantConfigurator = isVariantConfiguratorProduct(product);
  const descriptionHtml = product.description ? l10n(product.description) : '';

  useEffect(() => {
    logger.info(
      {
        productId: product.id,
        product,
        price,
        availability,
        quantity,
        shippingCost,
        shippingPostalCode,
      },
      'PDP hydrate snapshot',
    );
  }, [product, price, availability, quantity, shippingCost, shippingPostalCode, logger]);

  const handleAddToWishlist = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    addToWishlist(product.id, quantity);
  };

  const handleCompareClick = (): void => {
    toggleComparison(product.id, l10n(product.name));
  };

  const handleCopyItemNumber = (): void => {
    void copyProductItemNumber(product.id, t('itemNumberCopied'), (context, message) => {
      logger.error(context, message);
    });
  };

  return (
    <>
      <div className={cn('grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-10 lg:gap-x-16 mb-10', className)}>
        <div className="flex flex-col gap-6">
          <PdpGallery
            product={product}
            l10nOrEmpty={l10nOrEmpty}
            unlabeledAltWithId={(id) => t('primaryImageAltUnlabeled', { id })}
          />

          <PdpKeySpecsCard
            product={product}
            keySpecGroups={keySpecGroups}
            l10n={l10n}
            t={t}
            onCopyItemNumber={handleCopyItemNumber}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {showLabels && product.labels ? <ProductLabels labels={product.labels} /> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      size="icon"
                      variant={compareActive ? 'primary' : 'secondary'}
                      aria-label={t('compare')}
                      aria-pressed={compareActive}
                      onClick={handleCompareClick}
                      disabled={compareDisabled}
                    >
                      <FlipHorizontal2 />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {compareTooltip ?? (compareActive ? t('compareTooltipRemove') : t('compareTooltipAdd'))}
                </TooltipContent>
              </Tooltip>
              <WishlistPinButton
                disabled={wishlistDisabled}
                disabledTooltip={wishlistTooltip}
                isAdding={isAddingToWishlist}
                onClick={handleAddToWishlist}
              />
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="secondary" aria-label={t('share')}>
                    <Share2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('shareTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {product.brand ? (
            <PdpBrand
              name={product.brand.name ? l10n(product.brand.name) : undefined}
              logoUrl={product.brand.logo?.url}
            />
          ) : null}

          <div>
            <H1 className="text-2xl md:text-3xl lg:text-4xl">{headingName}</H1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-placeholders">
              <span>
                <span className="uppercase tracking-wide">{t('sku')}</span>:{' '}
                <span className="font-medium text-text-headings">{product.sku || product.id}</span>
              </span>
              <span className="hidden sm:inline text-border-primary">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="uppercase tracking-wide">{t('itemNumber')}</span>:{' '}
                <span className="font-medium text-text-headings">{product.id}</span>
                <button
                  type="button"
                  onClick={handleCopyItemNumber}
                  aria-label={t('copy')}
                  className="inline-flex cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </div>

          <div ref={addToCartButton}>
            <PdpPriceBlock price={price} quantity={quantity} />
          </div>

          {showVariantConfigurator ? null : (
            <ProductAddToCart
              product={product}
              price={price}
              availability={availability}
              availabilityLoading={availability === undefined}
              quantity={quantity}
              onQuantityChange={setQuantity}
            />
          )}

          {!showVariantConfigurator && isVariantFamilyProduct(product) ? (
            <ProductVariantSelector product={product} />
          ) : null}
          {showTierPrices && price ? <ProductTierPrices price={price} quantity={quantity} /> : null}

          <ProductShippingInfo
            className="mt-0"
            currency={price?.currency ?? session?.currency}
            shippingCost={shippingCost}
            postalCode={shippingPostalCode}
            deliveryDays={deliveryDays}
          />

          {descriptionHtml ? (
            <div className="border-t border-border-primary pt-6">
              <Overline className="mb-4 text-sm">{t('tabs.description')}</Overline>
              <ProductDescription html={descriptionHtml} />
            </div>
          ) : null}

          <PdpHighlights product={product} locale={locale} title={t('productHighlights')} />
        </div>

        {showVariantConfigurator ? null : (
          <div
            className={cn(
              'md:col-span-2',
              stickyAtcVisible ? 'opacity-100' : 'opacity-0',
              'transition-opacity ease-in-out delay-150 duration-300',
            )}
            ref={addToCartBar}
          >
            <ProductAddToCartBar
              product={product}
              price={price}
              availability={availability}
              availabilityLoading={availability === undefined}
            />
          </div>
        )}
      </div>
      {showVariantConfigurator ? (
        <ProductVariantSelector
          product={product}
          className={cn(className, 'mb-12 border-t border-border-primary pt-10')}
        />
      ) : null}
      {hasTechnicalInformation(product) ? (
        <PdpTechnicalInformation
          groups={technicalInfoGroups}
          className={className}
          l10n={l10n}
          t={t}
          title={t('technicalInformation')}
          templateAttributeTypes={product.templateAttributeTypes}
        />
      ) : null}

      <RelatedMaterials relatedItems={relatedItems} locale={locale} className={cn(className)} />

      <ProductDetailRecommendations productId={product.id} locale={locale} />
      {loginDialog}
    </>
  );
}

function ssrSeedFromInitialProduct(initialProduct: string | Product | undefined): Product | undefined {
  return initialProduct && typeof initialProduct !== 'string' ? initialProduct : undefined;
}

/** Login / ALL→ASSIGNED after mount: hide the previous unscoped seed while scoped refetch runs. */
function useEnteredAssignedAfterMount(productsMode: ProductsMode): boolean {
  const [prevProductsMode, setPrevProductsMode] = useState(productsMode);
  const [enteredAssignedAfterMount, setEnteredAssignedAfterMount] = useState(false);
  if (prevProductsMode !== productsMode) {
    setPrevProductsMode(productsMode);
    setEnteredAssignedAfterMount(productsMode === 'assigned' && prevProductsMode !== 'assigned');
  }
  return enteredAssignedAfterMount;
}

/** Assigned A→B customer switch: hide customer A's same-id seed while B's scoped refetch runs. */
function useCustomerChangedWhileAssigned(productsMode: ProductsMode, sessionCustomerId: string | undefined): boolean {
  const [prevSessionCustomerId, setPrevSessionCustomerId] = useState(sessionCustomerId);
  const [customerChangedWhileAssigned, setCustomerChangedWhileAssigned] = useState(false);
  if (prevSessionCustomerId !== sessionCustomerId) {
    setPrevSessionCustomerId(sessionCustomerId);
    setCustomerChangedWhileAssigned(
      productsMode === 'assigned' &&
        isAuthenticatedSessionCustomerId(prevSessionCustomerId) &&
        isAuthenticatedSessionCustomerId(sessionCustomerId),
    );
  }
  if (productsMode !== 'assigned' && customerChangedWhileAssigned) {
    setCustomerChangedWhileAssigned(false);
  }
  return customerChangedWhileAssigned;
}

function resolvePaintedPdpProduct(
  productsMode: ProductsMode,
  product: Product | null,
  loading: boolean,
  shopContextReady: boolean,
  hideUnscopedSeed: boolean,
  ssrSeedProduct: Product | undefined,
): Product | null {
  const assignedCatalogMiss = productsMode === 'assigned' && product === null && !loading && shopContextReady;
  if (assignedCatalogMiss || hideUnscopedSeed) {
    return null;
  }
  return product ?? ssrSeedProduct ?? null;
}

export default function ProductDetail({
  product: initialProduct,
  options,
  className,
  catalogDisplayName,
}: Readonly<ProductDetailProps>) {
  const { ready: shopContextReady } = useShopContextReady();
  const { product, loading, setAsCurrent } = useProduct(initialProduct, options);
  const { mode: productsMode } = useProductsMode();
  const { session } = useSession();
  // Usable SSR seed = full Product object (not an id string). Keep it as fallback during
  // session/pricing bootstrap so a transient null/error does not become false Not Found.
  const ssrSeedProduct = ssrSeedFromInitialProduct(initialProduct);
  const enteredAssignedAfterMount = useEnteredAssignedAfterMount(productsMode);
  const customerChangedWhileAssigned = useCustomerChangedWhileAssigned(productsMode, session?.customerId);
  const hideUnscopedSeed = (enteredAssignedAfterMount || customerChangedWhileAssigned) && (loading || product === null);
  const resolvedProduct = resolvePaintedPdpProduct(
    productsMode,
    product,
    loading,
    shopContextReady,
    hideUnscopedSeed,
    ssrSeedProduct,
  );
  usePdpCurrentProduct(resolvedProduct, setAsCurrent);

  // Painted seed/client product stays on screen during catalog refetch and shop-context
  // bootstrap. Full-page spinner only when there is nothing to paint.
  if (resolvedProduct !== null) {
    return (
      <PdpDetailView
        product={resolvedProduct}
        ssrSeedProduct={ssrSeedProduct}
        className={className}
        session={session}
        catalogDisplayName={catalogDisplayName}
      />
    );
  }

  if (!shopContextReady || loading) {
    return (
      <div className={cn('flex justify-center items-center min-h-[400px] mb-6', className)}>
        <Spinner variant="lg" />
      </div>
    );
  }

  // Confirmed absence only: no client product and no SSR Product seed (id-only / undefined seed).
  return notFound();
}
