'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLogger } from '@/hooks/common/useLogger';
import { setProductsMode } from '@/lib/client/customer-segment';
import { cn } from '@/lib/utils';

interface PlpProductsModeSwitchProps {
  className?: string;
}

/**
 * ASSIGNED / ALL products switch (COP-4822 AC3a, CR-1). Lives in the PLP "Categories" card header.
 * Renders only when the customer is segmented and the tenant config allows ALL PRODUCTS MODE
 * (`canToggleAllProducts`). Toggling persists the mode cookie via the BFF and refreshes the page so
 * the server re-resolves the products mode (category tree, header/footer labels and results).
 * Figma: n/a — Figma not ready; built from the AC text and the existing switch/label primitives.
 */
export function PlpProductsModeSwitch({ className }: PlpProductsModeSwitchProps) {
  const { mode, canToggleAllProducts } = useProductsMode();

  if (!canToggleAllProducts) {
    return null;
  }

  return <PlpProductsModeSwitchControl checked={mode === 'all'} className={className} />;
}

/** Inner control — only mounted when the switch is available, so router/logger hooks stay out of anonymous renders. */
function PlpProductsModeSwitchControl({ checked, className }: { checked: boolean; className?: string }) {
  const t = useTranslations('search.searchResults');
  const router = useRouter();
  const logger = useLogger();
  const switchId = useId();
  const [pending, setPending] = useState(false);

  const handleCheckedChange = async (checked: boolean) => {
    const nextMode = checked ? 'all' : 'assigned';
    setPending(true);

    try {
      const result = await setProductsMode(nextMode);

      if (!result.ok) {
        logger.error({ mode: nextMode }, 'Products mode toggle rejected');
        return;
      }

      router.refresh();
    } catch (err) {
      logger.error({ err, mode: nextMode }, 'Products mode toggle failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <Switch
        id={switchId}
        checked={checked}
        disabled={pending}
        onCheckedChange={(checked) => void handleCheckedChange(checked)}
        aria-label={t('productsModeSwitchLabel')}
        data-testid="plp-productsModeSwitch"
      />
      <Label
        htmlFor={switchId}
        className="whitespace-nowrap text-base leading-6 font-normal text-text-body"
        data-testid="plp-productsModeLabel"
      >
        {checked ? t('allProducts') : t('assignedProducts')}
      </Label>
    </div>
  );
}

export default PlpProductsModeSwitch;
