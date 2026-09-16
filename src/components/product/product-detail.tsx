'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowDown, Copy, FlipHorizontal2, Share2, Sun } from 'lucide-react';
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
import { useComparison } from '@/hooks/comparison/useComparison';
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
import { cn } from '@/lib/utils';
import type { LocalizedString, StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { GroupedSpecification, Product, ProductSpecification } from '@/platform/services/model/product';
import type { Session } from '@/platform/services/model/session/session';
import type { ProductFetchOptions } from '@/platform/services/product';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';
import Recommendations from '../cms/recommendations';
import { Button } from '../ui/button';
import { H1, H3, H4, H5 } from '../ui/h';
import UiLink from '../ui/link';
import { RatingStarRow } from '../ui/rating';
import { Spinner } from '../ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ProductAddToCart from './product-add-to-cart';
import ProductAddToCartBar from './product-add-to-cart-bar';
import { ProductDescription } from './product-description';
import { ProductLabels } from './product-labels';
import { ProductPriceComponent, ProductPriceSkeleton, ProductPriceUnavailable } from './product-price';
import { ProductShippingInfo } from './product-shipping-info';
import { ProductTierPrices } from './product-tier-prices';
import ProductVariantSelector from './product-variant-selector';

export interface ProductDetailProps {
  product?: Product | string;
  options: ProductFetchOptions;
  className?: string;
  /** Server-resolved catalog identity (locale + site default). H1 uses this when present. */
  catalogDisplayName?: string;
}

function PdpPriceBlock({ price }: Readonly<{ price: ProductPrice | null | undefined }>): React.ReactElement {
  if (price === undefined) {
    return <ProductPriceSkeleton />;
  }
  if (price === null) {
    return <ProductPriceUnavailable />;
  }
  return <ProductPriceComponent price={price} />;
}

function PdpBrandName({ name }: Readonly<{ name: string }>): React.ReactElement {
  // Follow-up: dedicated brand-listing route missing — brand-filtered PLP
  // `/browse?filters[brand.name][]=…` probe returned 0 hits for Victron Energy
  // (2026-08-06); keep non-interactive H5 to avoid a dead empty-result link (D10).
  return <H5 className="text-text-action">{name}</H5>;
}

function PdpBrand({
  name,
  logoUrl,
}: Readonly<{
  name?: string;
  logoUrl?: string;
}>): React.ReactElement | null {
  const trimmedLogoUrl = logoUrl?.trim();

  // Logo present → image only; name moves to tooltip.
  // Cap tall logos at toolbar height (max-h-12); smaller logos keep their intrinsic size.
  if (trimmedLogoUrl) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className="inline-flex max-h-12 shrink-0 items-center"
            aria-label={name || undefined}
            data-testid="product-brand-logo"
          >
            <Image
              src={trimmedLogoUrl}
              alt={name ?? ''}
              height={48}
              width={240}
              className="max-h-12 h-auto w-auto object-contain"
              // Brand assets are often SVG (no file extension on Cloudinary). Next/Image
              // optimizer rejects SVG → blank logo; serve the origin URL instead.
              unoptimized
            />
          </span>
        </TooltipTrigger>
        {name ? <TooltipContent>{name}</TooltipContent> : null}
      </Tooltip>
    );
  }

  if (name) {
    return <PdpBrandName name={name} />;
  }

  return null;
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

function applyProductComparisonToggle({
  productId,
  productName,
  isInComparison,
  isFull,
  toggleProduct,
  t,
}: Readonly<{
  productId: string;
  productName: string;
  isInComparison: boolean;
  isFull: boolean;
  toggleProduct: (id: string) => void;
  t: ReturnType<typeof useTranslations<'product'>>;
}>): void {
  if (isInComparison) {
    toggleProduct(productId);
    notify({ title: t('removedFromComparison', { name: productName }), type: ToastType.Info });
    return;
  }
  if (isFull) {
    notify({ title: t('comparisonFull', { max: MAX_COMPARISON_PRODUCTS }), type: ToastType.Warning });
    return;
  }
  toggleProduct(productId);
  notify({ title: t('addedToComparison', { name: productName }), type: ToastType.Success });
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
  const fewGroups = groups.length > 0 && groups.length < 4;

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
    <div id={PDP_TECHNICAL_INFORMATION_SECTION_ID} ref={sectionRef} className={cn(className)}>
      <H3 className="my-6">{title}</H3>
      <div
        className={cn(
          'mb-16 gap-x-6 gap-y-6 lg:gap-y-16 grid grid-cols-1 md:grid-cols-2',
          // D4: 1–3 groups fill the row equally at lg; 4+ keep four-per-row grid.
          fewGroups ? 'lg:flex lg:flex-row' : 'lg:grid-cols-4',
        )}
      >
        {groups.map((spec: GroupedSpecification, groupIndex) => {
          const groupTitle = resolveTechnicalGroupTitle(spec.groupName, l10n, t);
          return (
            <div
              className={cn('flex flex-col', fewGroups && 'lg:min-w-0 lg:flex-1')}
              key={`${groupTitle}-${groupIndex}`}
            >
              <p className="font-bold font-headlines font-sm p-4 border-b border-border-primary">{groupTitle}</p>
              {spec.item.map((i) => {
                const itemLabel = resolveTechnicalItemLabel(i.label, l10n);
                const unit = typeof i.unit === 'string' ? i.unit.trim() : l10n(i.unit).trim();
                const rawValue = l10n(i.value);
                const attributeType = i.attributeKey ? templateAttributeTypes?.[i.attributeKey] : undefined;
                return (
                  <div className="font-sm p-4 border-b border-border-primary flex gap-4" key={itemLabel}>
                    <p className="w-1/2 min-w-0 wrap-break-word">{itemLabel}</p>
                    <p className="flex w-1/2 min-w-0 items-center gap-1 wrap-break-word">
                      {i.attributeKey ? (
                        <TemplateAttributeValue value={rawValue} type={attributeType} locale={locale} />
                      ) : (
                        rawValue
                      )}
                      {unit ? ` ${unit}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
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
      <div className="bg-surface-image-background flex items-center justify-center">
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
    <Card variant="gray" rounded="lg" className="order-3 md:order-0 p-6 md:p-8 mb-6 md:mb-0">
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
}>): React.ReactElement {
  const locale = useLocale();
  const hasSpecs = keySpecGroups.some((group) => group.items.length > 0);
  const showGroupHeaders = keySpecGroups.length > 1;

  return (
    <Card variant="primary" rounded="lg" className="order-5 md:order-0 p-4 md:px-8 md:pb-8 md:pt-6 mb-8 md:mb-0">
      <CardContent className="p-0">
        <div className="flex flex-col gap-6">
          {hasSpecs ? (
            <>
              <H4 className="text-text-on-action">{t('keySpecs')}</H4>
              <div className="flex flex-col gap-6">
                {keySpecGroups.map((group) => {
                  const groupLabel = resolveKeySpecGroupLabel(group, t, l10n);
                  // Column-wise fill (lg:grid-flow-col) needs an explicit row count: with a fixed
                  // grid-rows-3, a 7th key spec would create implicit extra columns and overflow the card.
                  const keySpecRows = Math.max(3, Math.ceil(group.items.length / 2));
                  return (
                    <div key={group.id} className="flex flex-col gap-4" data-testid="product-key-spec-group">
                      {showGroupHeaders && groupLabel ? (
                        <div className="flex items-center gap-3">
                          <p className="shrink-0 font-headlines text-lg font-bold text-text-on-action">{groupLabel}</p>
                          <Separator className="min-w-0 flex-1 bg-text-on-action/40" />
                        </div>
                      ) : null}
                      <div
                        className="grid grid-cols-1 grid-rows-3 gap-x-12 gap-y-6 lg:grid-cols-2 lg:grid-flow-col lg:grid-rows-[var(--key-spec-rows)]"
                        style={
                          { '--key-spec-rows': `repeat(${keySpecRows}, minmax(0, max-content))` } as React.CSSProperties
                        }
                      >
                        {group.items.map((spec: ProductSpecification) => (
                          <BulletPoint
                            key={spec.key}
                            label={resolveKeySpecLabel(spec, l10n)}
                            className="min-w-0 items-start"
                            labelClassName="min-w-0 shrink font-headlines text-2xl font-bold"
                            variant="white"
                            iconColor="white"
                            iconSize="lg"
                            value={renderKeySpecValue(spec, l10n, locale, product.templateAttributeTypes)}
                            valueClassName="min-w-0 max-w-[60%] shrink-0 text-right font-normal break-words whitespace-normal"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {/* D6: keep "More product features" despite newest Figma Specs List Area omitting it.
              Same row as item number (right-aligned); wraps as a unit when the row is too narrow. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 max-w-full items-center">
              <span className="shrink-0 text-text-on-action font-bold">{t('itemNumber')}:</span>
              <span className="text-text-action ml-2 bg-surface-page py-2 px-3 rounded flex min-w-0 items-center gap-3">
                <p className="min-w-0 break-all">{product.id}</p>
                <button
                  type="button"
                  onClick={onCopyItemNumber}
                  aria-label={t('copy')}
                  className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-text-action outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1"
                >
                  <Copy aria-hidden="true" className="size-6" />
                </button>
              </span>
            </div>
            {hasTechnicalInformation(product) ? (
              <UiLink
                type="A"
                href={getPdpTechnicalInformationHref()}
                variant="clean"
                size="m"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-bold text-text-on-action underline hover:text-text-on-action"
                iconAfter={<ArrowDown aria-hidden="true" className="size-4 shrink-0" />}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToPdpAnchor(PDP_TECHNICAL_INFORMATION_SECTION_ID);
                }}
              >
                {t('more')}
              </UiLink>
            ) : null}
          </div>
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
    <div className="order-6 md:order-0 md:mt-10">
      <H3 className="text-text-action mb-8">{title}</H3>
      <div className="mb-8 md:mb-0">
        {(product.highlights?.[locale] ?? []).map((highlight) => (
          <BulletPoint
            key={highlight}
            label={highlight}
            iconColor="primary"
            variant="default"
            size="lg"
            icon={Sun}
            className="mb-6 gap-4"
          />
        ))}
      </div>
    </div>
  );
}

interface PdpDetailViewProps {
  product: Product;
  className?: string;
  price: ProductPrice | null | undefined;
  availability: StockAvailability | undefined;
  session: Session | null | undefined;
  catalogDisplayName?: string;
}

function PdpDetailView({
  product,
  className,
  price,
  availability,
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
  const { isInComparison, toggleProduct, isFull } = useComparison();
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(product);
  const addToCartButton = useRef<HTMLDivElement>(null);
  const addToCartBar = useRef<HTMLDivElement>(null);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(product, price, 'wishlist');
  const [quantity, setQuantity] = useState(1);
  const { shippingCost, postalCode: shippingPostalCode } = usePdpShippingCost(price, quantity);
  const stickyAtcVisible = usePdpStickyAtcVisibility(addToCartButton, isAboveMediumScreen);
  const showLabels = hasProductLabels(product);
  const showTierPrices = price != null && (price.tierValues?.length ?? 0) > 1;
  const deliveryDays = resolvePdpDeliveryDays(availability);
  const keySpecGroups = getKeySpecificationGroups(product);
  const technicalInfoGroups = getTechnicalInformationGroups(product);
  const compareActive = isInComparison(product.id);

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
    applyProductComparisonToggle({
      productId: product.id,
      productName: l10n(product.name),
      isInComparison: compareActive,
      isFull,
      toggleProduct,
      t,
    });
  };

  const handleCopyItemNumber = (): void => {
    void copyProductItemNumber(product.id, t('itemNumberCopied'), (context, message) => {
      logger.error(context, message);
    });
  };

  return (
    <>
      {/*
        PDP Top Area grid (Figma 12830:188844 / tablet 12823:84626 / mobile 12823:74032):
        - md+: two independent columns via contents→flex wrappers (left: gallery → key specs → highlights;
          right: tags+toolbar → title → price/ATC/shipping)
        - below md: `contents` flattens children into the parent grid; order-* matches mobile/tablet stack:
          title → tags+toolbar → gallery → price → key specs → highlights
      */}
      <div className={cn('grid grid-cols-1 gap-x-4 md:gap-x-12 lg:gap-x-20 md:grid-cols-2 mb-6', className)}>
        <div className="contents md:flex md:flex-col md:gap-6">
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

          <PdpHighlights product={product} locale={locale} title={t('productHighlights')} />
        </div>

        <div className="contents md:flex md:flex-col">
          {/* Single Compare/Wishlist/Share toolbar at every breakpoint (Figma Tag & Toolbar Row) */}
          <div
            className={cn(
              'order-2 md:order-0 flex flex-col gap-2 sm:flex-row sm:items-start mb-4 md:mb-0',
              showLabels ? 'sm:justify-between' : 'sm:justify-end',
            )}
          >
            {showLabels && product.labels ? <ProductLabels labels={product.labels} /> : null}
            <div className="flex gap-2">
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

          <div className="order-1 md:order-0 flex flex-col gap-2">
            {product.brand ? (
              <PdpBrand
                name={product.brand.name ? l10n(product.brand.name) : undefined}
                logoUrl={product.brand.logo?.url}
              />
            ) : null}
            <H1>{headingName}</H1>
            {product.description ? <ProductDescription html={l10n(product.description)} /> : null}
            <div className="mb-6 md:mb-0 flex gap-2 items-center">
              <p className="text-text-on-disabled font-bold">4.6</p>
              <RatingStarRow starsCount={5} filledCount={4} className="py-2" />
              <p className="text-text-on-disabled text-sm">(114)</p>
            </div>
          </div>

          <div className="order-4 md:order-0 min-w-0">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 md:grid-cols-3 lg:grid-cols-4"
              ref={addToCartButton}
            >
              <div className="col-start-1 sm:row-start-1 sm:col-end-3 md:col-end-4 lg:col-end-5">
                <PdpPriceBlock price={price} />
              </div>
            </div>
            <ProductAddToCart
              product={product}
              price={price}
              availability={availability}
              availabilityLoading={availability === undefined}
              quantity={quantity}
              onQuantityChange={setQuantity}
              className="mt-6"
            />
            {isVariantFamilyProduct(product) ? <ProductVariantSelector product={product} className="mt-6" /> : null}
            {showTierPrices && price ? <ProductTierPrices price={price} quantity={quantity} /> : null}
            <ProductShippingInfo
              currency={price?.currency ?? session?.currency}
              shippingCost={shippingCost}
              postalCode={shippingPostalCode}
              deliveryDays={deliveryDays}
            />
          </div>
        </div>
      </div>
      <div
        className={cn(
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

      <Recommendations
        id={product.id}
        type="recommendations"
        productId={product.id}
        locale={locale}
        overline={t('productRecommendations.overline')}
        headline={t('productRecommendations.headline')}
      />
      {loginDialog}
    </>
  );
}

export default function ProductDetail({
  product: initialProduct,
  options,
  className,
  catalogDisplayName,
}: Readonly<ProductDetailProps>) {
  const { ready: shopContextReady } = useShopContextReady();
  const { product, loading, error, setAsCurrent } = useProduct(initialProduct, options);
  const { mode: productsMode } = useProductsMode();
  const { session } = useSession();
  const { site } = useSite();
  // Usable SSR seed = full Product object (not an id string). Keep it as fallback during
  // session/pricing bootstrap so a transient null/error does not become false Not Found.
  const ssrSeedProduct = initialProduct && typeof initialProduct !== 'string' ? initialProduct : undefined;
  // COP-4822 AC4: assigned mode must not keep painting an out-of-segment seed after a
  // confirmed catalog miss. A hook `error` is not a catalog miss (price / session / 5xx) —
  // keep the SSR seed and omit the price instead of sending the customer to Not Found.
  const assignedCatalogMiss =
    productsMode === 'assigned' && product === null && error == null && !loading && shopContextReady;
  const resolvedProduct = assignedCatalogMiss ? null : (product ?? ssrSeedProduct ?? null);
  const { price, availability } = usePdpPurchaseData(resolvedProduct, session, site);
  usePdpCurrentProduct(resolvedProduct, setAsCurrent);

  // Painted seed/client product stays on screen during catalog refetch and shop-context
  // bootstrap. Full-page spinner only when there is nothing to paint.
  if (resolvedProduct !== null) {
    return (
      <PdpDetailView
        product={resolvedProduct}
        className={className}
        price={price}
        availability={availability}
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
