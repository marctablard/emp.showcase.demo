'use client';

import { useTranslations } from 'next-intl';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useIsHydrated } from '@/hooks/common/useIsHydrated';
import { useComparison } from '@/hooks/comparison/useComparison';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';

interface UseComparisonToggleResult {
  /**
   * Whether the product sits in the comparison — `false` until the client has hydrated, see below.
   * For rendering only; `toggle` always acts on the real state.
   */
  isInComparison: (productId: string) => boolean;
  isFull: boolean;
  /** Adds or removes the product and reports the outcome as a toast. */
  toggle: (productId: string, productName: string) => void;
}

/**
 * The behaviour every compare button shares: toggle the product, report the outcome as a toast,
 * and answer whether a product is in the comparison.
 *
 * Reports `false` until hydrated. The state comes from `localStorage`, and React keeps what the
 * server sent for differing *attributes* (`aria-pressed`, variant classes) — unlike text, it does
 * not repair them, which lost the pressed state on every reload. `toggle` still reads the store
 * directly: a click before hydration must act on what is stored, not on the placeholder.
 */
export function useComparisonToggle(): UseComparisonToggleResult {
  const t = useTranslations('product');
  const { isInComparison, toggleProduct, isFull } = useComparison();
  const hydrated = useIsHydrated();

  const toggle = (productId: string, productName: string): void => {
    if (isInComparison(productId)) {
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
  };

  return {
    isInComparison: (productId: string) => hydrated && isInComparison(productId),
    isFull,
    toggle,
  };
}

export default useComparisonToggle;
