'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowDown, Copy, FlipHorizontal2, Pin, Share2, Sun } from 'lucide-react';
import { ProductCarousel } from '@/components/product/product-carousel';
import { Badge } from '@/components/ui/badge';
import { BulletPoint } from '@/components/ui/bullet-point';
import { Card, CardContent } from '@/components/ui/card';
import { useProduct } from '@/hooks/product/useProduct';
import { useSession } from '@/hooks/session/useSession';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useL10n } from '@/hooks/useL10n';
import { type ProductTemplateAttributeKey, type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import { cn } from '@/lib/utils';
import { StockAvailability } from '@/platform/services/model/common';
import { ProductPrice } from '@/platform/services/model/price';
import { GroupedSpecification, Product, ProductVariantAttribute } from '@/platform/services/model/product';
import { ProductFetchOptions } from '@/platform/services/product';
import Recommendations from '../cms/recommendations';
import { Button } from '../ui/button';
import { H1, H2, Overline } from '../ui/h';
import UiLink from '../ui/link';
import { RatingStarRow } from '../ui/rating';
import { Spinner } from '../ui/spinner';
import ProductAddToCart from './product-add-to-cart';
import ProductAddToCartBar from './product-add-to-cart-bar';
import { ProductPriceComponent, ProductPriceSkeleton } from './product-price';
import { ProductShippingInfo } from './product-shipping-info';
import ProductVariantSelector from './product-variant-selector';
import { RelatedMaterials } from './related-materials';

export interface ProductDetailProps {
  product?: Product | string;
  options: ProductFetchOptions;
  className?: string;
}

export default function ProductDetail({ product: initialProduct, options, className }: ProductDetailProps) {
  const { product, loading, setAsCurrent } = useProduct(initialProduct, options);
  const { session } = useSession();
  const [price, setPrice] = useState<ProductPrice | null | undefined>(product?.price);
  const [availability, setAvailability] = useState<StockAvailability | undefined>(product?.availability);
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('product');
  const isAboveMediumScreen = useBreakpoint('md');
  const addToCartButton = useRef<HTMLDivElement>(null);
  const addToCartBar = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = React.useState(false);
  //   const { recommendations, loading: recLoading } = useRecommendations(product?.id);
  useEffect(() => {
    if (product) {
      setAsCurrent();
    }
    return () => {
      setAsCurrent(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // asynchronous price fetching if not provided in SSR
  useEffect(() => {
    if (product) {
      if (product.price === undefined || session?.currency != price?.currency) {
        fetchProductPrice(product.id).then((price) => {
          setPrice(price);
        });
      }
      if (product.availability === undefined) {
        fetchProductAvailability(product.id).then((availability) => {
          setAvailability(availability);
        });
      }
    } else {
      setPrice(undefined);
      setAvailability(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, session?.currency]);

  useEffect(() => {
    if (addToCartButton.current !== null && isAboveMediumScreen) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setOpacity(false);
            } else {
              setOpacity(true);
            }
          });
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 1.0,
        },
      );

      // Observe an element
      observer.observe(addToCartButton.current);
    }
  });

  if (loading) {
    return (
      <div className={cn('flex justify-center items-center min-h-[400px] mb-6', className)}>
        <Spinner variant="lg" />
      </div>
    );
  }

  if (product === null) {
    return notFound();
  }

  return (
    <>
      <div className={cn('grid grid-cols-1 gap-x-4 md:gap-x-12 lg:gap-x-20 md:grid-cols-2 mb-6', className)}>
        <Card
          variant="gray"
          rounded="lg"
          className="row-start-3 md:col-start-1 md:row-start-1 md:row-end-4 p-6 md:p-8 mb-6"
        >
          <CardContent className="px-0">
            <div className="overflow-hidden">
              {product.images && product.images.length > 0 ? (
                product.images.length === 1 ? (
                  <div className="relative aspect-square">
                    <Image
                      src={product.images[0].url}
                      alt={product.images[0].altText ? l10n(product.images[0].altText) : l10n(product.name)}
                      fill
                      className="object-contain object-center"
                    />
                  </div>
                ) : (
                  <ProductCarousel images={product.images} />
                )
              ) : (
                <div className="bg-surface-image-background flex items-center justify-center">
                  <Image src={'/images/no_image_alt.png'} alt={l10n(product.name)} width={90} height={90} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="md:col-start-1">
          {(product.variantAttributes || product.templateAttributes) && (
            <Card variant="primary" rounded="lg" className="p-4 md:px-8 md:pb-8 md:pt-6 mb-10 md:mb-0">
              <CardContent className="p-0">
                <div className="flex flex-col gap-6">
                  <H2 variant="h4" className="text-text-on-action">
                    {t('keySpecs')}
                  </H2>
                  <div className="grid grid-cols-1 grid-rows-3 lg:grid-cols-2 gap-y-6 gap-x-12">
                    {product.variantAttributes?.map((attribute: ProductVariantAttribute) => (
                      <BulletPoint
                        key={attribute.key}
                        className="font-bold"
                        label={l10n(
                          t(
                            dk<ProductVariantAttributeKey>(`filters.mixins.productVariantAttributes.${attribute.key}`),
                            {
                              defaultValue: attribute.key,
                            },
                          ),
                        )}
                        variant="white"
                        iconColor="white"
                        value={l10n(product.variantAttributeValues?.[attribute.key] ?? '')}
                      />
                    ))}
                    {Object.keys(product.templateAttributes || {}).map((attribute: string) => (
                      <BulletPoint
                        className="font-bold"
                        key={attribute}
                        label={t(
                          dk<ProductTemplateAttributeKey>(`filters.mixins.productTemplateAttributes.${attribute}`),
                          {
                            defaultValue: attribute,
                          },
                        )}
                        variant="white"
                        iconColor="white"
                        value={l10n(product.templateAttributes?.[attribute] ?? '')}
                      />
                    ))}
                  </div>

                  <div className="flex items-center mt-2">
                    <button className="text-text-on-action flex items-center gap-1">
                      <UiLink type="Link" className="text-text-on-action hover:text-text-on-action">
                        {t('more')}
                      </UiLink>
                      <ArrowDown />
                    </button>
                  </div>

                  <div className="flex items-center mt-2">
                    <span className="text-text-on-action font-bold">{t('itemNumber')}:</span>
                    <span className="text-text-action ml-2 bg-surface-page py-2 px-3 rounded flex items-center">
                      <p className="mr-2">{product.id}</p>
                      <Copy aria-label={t('copy')} />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="md:col-start-2 row-start-1 h-[50px]">
          <div>
            <div className="flex justify-between">
              <div className="flex gap-2">
                {product.labels?.map((label) => (
                  <Badge key={label.id} variant="info" rounded="roundedRight" className="h-7">
                    {label.name}
                  </Badge>
                ))}
              </div>
              <div className="hidden md:flex gap-2">
                <Button size="icon" variant="secondary" aria-label={t('compare')}>
                  <FlipHorizontal2 />
                </Button>
                <Button size="icon" variant="secondary" aria-label={t('addToWishlist')}>
                  <Pin />
                </Button>
                <Button size="icon" variant="secondary" aria-label={t('share')}>
                  <Share2 />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="row-start-2 md:col-start-2 md:row-start-2">
          {product.brand && (
            <Overline className="flex items-center gap-2">
              {product.brand.logo?.url && (
                <Image
                  src={product.brand.logo?.url}
                  alt={product.brand.name ? l10n(product.brand.name) : ''}
                  height={70}
                  width={70}
                />
              )}
              <span>{product.brand.name ? l10n(product.brand.name) : ''}</span>
            </Overline>
          )}
          <H1>{l10n(product.name)}</H1>
          <div className="mb-6 md:md-0 flex gap-2 items-center">
            <p className="text-text-on-disabled font-bold">4.6</p>
            <RatingStarRow starsCount={5} filledCount={4} className="py-2" />
            <p className="text-text-on-disabled text-sm">(114)</p>
          </div>
        </div>
        <div className="row-start-4 md:col-start-2 md:row-start-3">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 md:grid-cols-3 lg:grid-cols-4"
            ref={addToCartButton}
          >
            <div className="col-start-1 sm:row-start-1 md:col-end-4 xl-col-end-5">
              {price === undefined ? <ProductPriceSkeleton /> : <ProductPriceComponent price={price} />}
            </div>
          </div>
          <ProductAddToCart product={product} price={price} className="mt-6" />
          <div className="flex md:hidden justify-center gap-2 mt-6">
            <Button size="icon" variant="secondary" aria-label={t('compare')}>
              <FlipHorizontal2 />
            </Button>
            <Button size="icon" variant="secondary" aria-label={t('addToWishlist')}>
              <Pin />
            </Button>
            <Button size="icon" variant="secondary" aria-label={t('share')}>
              <Share2 />
            </Button>
          </div>
          {product.variantAttributes && <ProductVariantSelector product={product} className="mt-6" />}
          <ProductShippingInfo
            deliveryDays={
              availability?.isAvailable
                ? [0, 0]
                : [availability?.availableInDays || 1, (availability?.availableInDays || 1) + 2]
            }
          />
        </div>
        <div
          className={cn(opacity ? 'opacity-100' : 'opacity-0', 'transition-opacity ease-in-out delay-150 duration-300')}
          ref={addToCartBar}
        >
          <ProductAddToCartBar product={product} price={price} />
        </div>

        <div className="row-start-5 md:col-start-2 md:row-start-4 mt-8 md:mt-0">
          <div className="text-lg md:mt-6" dangerouslySetInnerHTML={{ __html: l10n(product.description) }} />
          {product.highlights && (
            <div className="mt-10 md:mt-16">
              <H2 variant="h3" className="text-text-action mb-8">
                {t('productHighlights')}
              </H2>
              <div className="mb-10 md:mb-0">
                {product.highlights[locale]?.length > 0 &&
                  product.highlights[locale].map((highlight) => (
                    <BulletPoint
                      key={highlight}
                      label={highlight}
                      iconColor="primary"
                      variant="default"
                      size="lg"
                      icon={Sun}
                      className="mb-6"
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {product?.groupedSpecifications?.length ? (
        <div className={cn(className)}>
          <H2 variant="h3" className="my-6">
            {' '}
            {t('technicalInformation')}
          </H2>
          <div className="grid grid-cols-1 gap-y-6 md:gap-y-16 gap-x-6 md:grid-cols-2 lg:grid-cols-4 mb-16">
            {product.groupedSpecifications.map((spec: GroupedSpecification, index) => {
              return (
                <div className="flex flex-col" key={index}>
                  <p className="font-bold font-headlines font-sm p-4 border-b border-border-primary">
                    {l10n(spec.groupName)}
                  </p>
                  {spec.item.map((i) => (
                    <div className="font-sm p-4 border-b border-border-primary flex gap-4" key={l10n(i.label)}>
                      <p className="w-1/2">{l10n(i.label)}</p>
                      <p className="w-1/2">
                        {l10n(i.value)} {l10n(i.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <RelatedMaterials relatedItems={product.relatedItems} locale={locale} className={cn(className)} />

      <Recommendations
        productId={product.id}
        locale={locale}
        overline={t('productRecommendations.overline')}
        headline={t('productRecommendations.headline')}
      />
    </>
  );
}
