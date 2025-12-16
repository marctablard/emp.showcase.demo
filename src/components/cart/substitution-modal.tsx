'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Leaf, Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { H3 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/hooks/cart/useCart';
import { useAvailability } from '@/hooks/product/useAvailability';
import { useL10n } from '@/hooks/useL10n';
import { fetchProductPrice } from '@/lib/client/prices';
import { fetchProductById } from '@/lib/client/products';
import { formatCurrency } from '@/lib/utils';
import { CartItem, CartItemSubstitution } from '@/platform/services/model/cart/cart.d';
import { ProductPrice } from '@/platform/services/model/price/price';
import { Product } from '@/platform/services/model/product';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface SubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItem: CartItem;
  substitution: CartItemSubstitution;
  onDone: () => void;
}

export function SubstitutionModal({ isOpen, onClose, cartItem, substitution, onDone }: SubstitutionModalProps) {
  const t = useTranslations('cart');
  const { l10n } = useL10n();
  const { updateItemQuantity, addItem, loading } = useCart();
  const [selectedSubstitutions, setSelectedSubstitutions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [priceMap, setPriceMap] = useState<Record<string, ProductPrice>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const { availability } = useAvailability(cartItem.product?.id);
  // Get original product ID
  const originalProductId = cartItem.product?.id || '';

  // Get original product price
  const originalPrice = priceMap[originalProductId]?.originalAmount || 0;
  const originalCurrency = priceMap[originalProductId]?.currency || 'EUR';

  // Calculate price difference between original and substitution
  const calculatePriceDifference = (substitutionPrice: number) => {
    const difference = substitutionPrice - originalPrice;
    const sign = difference > 0 ? '+' : '';
    return {
      difference,
      formattedDifference: `${sign}${formatCurrency(difference, originalCurrency)}`,
    };
  };

  // Fetch product details for all substitutions
  useEffect(() => {
    const fetchSubstitutionProducts = async () => {
      setIsLoading(true);
      try {
        const productIds = substitution.substitutions.map((sub) => sub.productId);
        productIds.push(originalProductId);
        const productPromises = productIds.map((id) => fetchProductById(id));
        const products = await Promise.all(productPromises);

        // Create a map of product ID to product data
        const newProductMap: Record<string, Product> = {};
        products.forEach((product, index) => {
          newProductMap[productIds[index]] = product;
        });

        setProductMap(newProductMap);
      } catch (error) {
        console.error('Error fetching substitution products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (substitution?.substitutions?.length > 0) {
      fetchSubstitutionProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substitution]);

  // Fetch prices for original product and substitutions
  useEffect(() => {
    const fetchPrices = async () => {
      setIsPriceLoading(true);
      try {
        // Get all product IDs (original + substitutions)
        const productIds = [originalProductId, ...substitution.substitutions.map((sub) => sub.productId)].filter(
          Boolean,
        ); // Filter out empty IDs

        // Fetch prices for all products
        const pricePromises = productIds.map((id) => fetchProductPrice(id));
        const prices = await Promise.all(pricePromises);

        // Create a map of product ID to price data
        const newPriceMap: Record<string, ProductPrice> = {};
        prices.forEach((price, index) => {
          if (price) {
            newPriceMap[productIds[index]] = price;
          }
        });

        setPriceMap(newPriceMap);
      } catch (error) {
        console.error('Error fetching product prices:', error);
      } finally {
        setIsPriceLoading(false);
      }
    };

    // Only fetch prices if we have product IDs
    if (originalProductId || substitution?.substitutions?.length > 0) {
      fetchPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substitution]);

  // Handle substitution selection
  const handleSelectSubstitution = (productId: string) => {
    setSelectedSubstitutions((prev) => {
      // If already selected, remove it
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      // Otherwise add it
      return [...prev, productId];
    });
  };

  // Handle applying the selected substitutions
  const handleAddSubstitution = async () => {
    if (selectedSubstitutions.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const remainder = cartItem.quantity - (availability?.availableQuantity || 0);

      // Find all valid selected products
      const selectedProducts = selectedSubstitutions
        .map((productId) => substitution.substitutions.find((sub) => sub.productId === productId))
        .filter(Boolean);

      if (selectedProducts.length > 0) {
        // Calculate total available quantity across all selected products
        const totalAvailableQty = selectedProducts.reduce((sum, product) => sum + (product?.availableQuantity || 0), 0);
        let quantityAdded = 0;
        // TODO optimize to properly distribute if one product has less than what's required
        // If we have enough total availability
        if (totalAvailableQty >= remainder) {
          // Calculate base quantity per product (floor division)
          const baseQtyPerProduct = Math.floor(remainder / selectedProducts.length);
          // Calculate remaining units to distribute one by one
          let remainingUnits = remainder - baseQtyPerProduct * selectedProducts.length;

          // Add each selected substitution with distributed quantity
          for (const product of selectedProducts) {
            if (!product) continue;

            // Base quantity + possibly one extra unit from remainder
            let quantityToAdd = baseQtyPerProduct;
            if (remainingUnits > 0) {
              quantityToAdd++;
              remainingUnits--;
            }

            // Ensure we don't exceed this product's availability
            quantityToAdd = Math.min(quantityToAdd, product.availableQuantity);

            // Only add if quantity is positive
            if (quantityToAdd > 0) {
              await addItem(product.productId, quantityToAdd);
              quantityAdded += quantityToAdd;
            }
          }
        } else {
          // Not enough total availability, add what we can
          for (const product of selectedProducts) {
            if (!product || product.availableQuantity <= 0) continue;
            await addItem(product.productId, product.availableQuantity);
            quantityAdded += product.availableQuantity;
          }
        }
        updateItemQuantity(cartItem.id, cartItem.quantity - quantityAdded);
      }

      onDone();
    } catch (error) {
      console.error('Error applying substitutions:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle keeping the original product
  const handleKeepBackorder = () => {
    onDone();
  };

  // Handle viewing cart
  const handleReduceAmount = () => {
    updateItemQuantity(cartItem.id, availability?.availableQuantity || 0);
    onDone();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('substitution.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          {/* Original product */}
          <div className="border-b pb-4">
            <H3 className="text-base font-medium mb-2">{t('substitution.originalProduct')}</H3>
            <div className="flex items-center gap-4">
              <div className="rounded-ss-md rounded-ee-md w-[100px] h-[65px] object-fit overflow-hidden">
                {cartItem.product && cartItem.product.images?.length ? (
                  <Image
                    width={100}
                    height={65}
                    src={String(cartItem.product.images[0].url)}
                    alt={String(cartItem.product.name || 'Product')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-icon-secondary">
                    <ShoppingCart className="h-6 w-6 opacity-30" />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{l10n(productMap[originalProductId]?.brand?.name || '')}</p>
                    <p className="font-bold">{l10n(productMap[originalProductId]?.name || 'Product')}</p>

                    <p className="text-sm text-text-placeholders pr-4">
                      {t('itemNumber')}: {cartItem.product?.id}
                    </p>
                  </div>

                  <div className="text-right">
                    {isPriceLoading ? (
                      <>
                        <div className="h-3 bg-bg-surface-disabled rounded w-20 mb-2 animate-pulse ml-auto"></div>
                        <div className="h-5 bg-bg-surface-disabled rounded w-16 animate-pulse ml-auto"></div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-text-placeholders">{t('pricePerUnit')}</div>
                        <div className="font-bold">{formatCurrency(originalPrice, originalCurrency)}</div>
                      </>
                    )}
                  </div>
                </div>

                {availability && (
                  <div className="flex items-center justify-between">
                    {availability.availableQuantity && (
                      <p className="text-sm font-bold pr-4">
                        {t('substitution.availableDescription', {
                          available: availability.availableQuantity,
                          total: cartItem.quantity,
                        })}
                      </p>
                    )}
                    {availability.availableInDays && (
                      <p className="text-sm font-bold text-text-warning pr-4 justify-end">
                        {t('substitution.availableInDays', { days: availability.availableInDays })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Substitution options */}
          <div>
            <H3 className="text-base font-medium mb-2">{t('substitution.availableSubstitutions')}</H3>
            <p className="text-sm text-text-placeholders mb-4">{t('substitution.selectAlternative')}</p>

            <div className="space-y-2">
              {substitution.substitutions.map((sub) => {
                const isSelected = selectedSubstitutions.includes(sub.productId);
                return (
                  <div
                    key={sub.productId}
                    className={`flex items-center space-x-4 rounded-ss-md rounded-ee-md p-4 mb-2 cursor-pointer transition-colors ${isSelected ? 'bg-surface-action-hover-2' : ''}`}
                    onClick={() => handleSelectSubstitution(sub.productId)}
                  >
                    <div className="flex-grow flex items-center gap-4">
                      {/* Product image thumbnail */}
                      <div className="rounded-ss-md rounded-ee-md w-[60px] h-[60px] object-fit overflow-hidden flex-shrink-0">
                        {isLoading ? (
                          <div className="w-full h-full bg-surface-image-background animate-pulse" />
                        ) : productMap[sub.productId]?.images?.length ? (
                          <Image
                            width={60}
                            height={60}
                            src={String(productMap[sub.productId]?.images?.[0]?.url || '')}
                            alt={String(productMap[sub.productId]?.name || 'Product')}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-icon-secondary bg-surface-image-background">
                            <ShoppingCart className="h-4 w-4 opacity-30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow">
                        {isLoading ? (
                          <>
                            <div className="h-5 bg-surface-disabled rounded w-3/4 mb-2 animate-pulse"></div>
                            <div className="h-5 bg-surface-disabled rounded w-3/4 mb-2 animate-pulse"></div>
                            <div className="h-3 bg-surface-disabled rounded w-1/2 mb-2 animate-pulse"></div>
                            <div className="h-3 bg-surface-disabled rounded w-1/3 animate-pulse"></div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm">{l10n(productMap[sub.productId]?.brand?.name || '')}</p>
                            <p className="font-bold text-sm line-clamp-1">
                              {l10n(productMap[sub.productId]?.name || sub.name)}
                            </p>
                            <p className="text-sm text-text-placeholders">
                              {t('itemNumber')}: {sub.productId}
                            </p>
                            <p className="text-sm">
                              <Package className="h-4 w-4 text-text-success float-left mr-2" />
                              <span className="text-text-success">
                                {t('substitution.availableQty')}: {sub.availableQuantity}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                      <div className="text-right ml-2">
                        {isLoading || isPriceLoading ? (
                          <>
                            <div className="h-3 bg-surface-disabled rounded w-20 mb-2 animate-pulse ml-auto"></div>
                            <div className="h-5 bg-surface-disabled rounded w-16 mb-2 animate-pulse ml-auto"></div>
                            <div className="h-3 bg-surface-disabled rounded w-12 animate-pulse ml-auto"></div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm text-text-placeholders whitespace-nowrap">{t('pricePerUnit')}</div>
                            <div className="font-bold">
                              {formatCurrency(
                                priceMap[sub.productId]?.amount || 0,
                                priceMap[sub.productId]?.currency || originalCurrency,
                              )}
                            </div>
                            {priceMap[sub.productId] &&
                              priceMap[originalProductId] &&
                              priceMap[sub.productId].amount !== priceMap[originalProductId].amount && (
                                <div
                                  className={`text-sm font-medium ${priceMap[sub.productId].amount > priceMap[originalProductId].amount ? 'text-text-error' : 'text-text-success'}`}
                                >
                                  {calculatePriceDifference(priceMap[sub.productId].amount).formattedDifference}
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-2">
                      {isSelected ? (
                        <div className="h-5 w-5 flex items-center justify-center text-text-action">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      ) : (
                        <div className="h-5 w-5"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-4">
              <Tooltip>
                <TooltipTrigger tabIndex={-1} className="flex items-center gap-1  text-text-placeholders">
                  <Leaf
                    className="text-text-success mr-2 float-left"
                    size={20}
                    aria-label={t('substitution.sustainabilityNote')}
                  />
                  <span className="text-sm">{t('substitution.sustainabilityClaim')}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('substitution.sustainabilityNote')}</p>
                </TooltipContent>
              </Tooltip>
              <div className="text-sm text-text-placeholders flex items-center gap-1">
                <span>{t('substitution.poweredBy')}</span>
                <Image src="/images/celonis.png" alt="Celonis" width={70} height={30} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 gap-4">
          <Button
            className="w-full"
            onClick={handleAddSubstitution}
            disabled={selectedSubstitutions.length === 0 || isProcessing || loading}
          >
            {isProcessing || loading ? (
              <Spinner color="white" variant="xs" />
            ) : selectedSubstitutions.length > 0 ? (
              `${t('substitution.addSubstitution')} (${selectedSubstitutions.length})`
            ) : (
              t('substitution.addSubstitution')
            )}
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleReduceAmount}>
            {t('substitution.reduceAmount')}
          </Button>
          <UiLink type="Button" onClick={handleKeepBackorder} className="flex justify-center">
            {t('substitution.keepBackorder')}
          </UiLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SubstitutionModal;
