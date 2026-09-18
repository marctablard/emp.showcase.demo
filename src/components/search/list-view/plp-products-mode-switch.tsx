'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useLogger } from '@/hooks/common/useLogger';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { setProductsMode } from '@/lib/client/customer-segment';
import { cn } from '@/lib/utils';

interface PlpProductsModeSwitchProps {
  className?: string;
}

/**
 * ASSIGNED / ALL products segmented control (COP-4822 AC3a, CR-1). Lives in the PLP "Categories"
 * card header. Same visual pattern as `CompanyScopeToggle` (`src/components/account/users/company-scope-toggle.tsx`).
 * Renders only when the customer is segmented and the tenant config allows ALL PRODUCTS MODE
 * (`canToggleAllProducts`). Toggling persists the mode cookie via the BFF and refreshes the page so
 * the server re-resolves the products mode (category tree, header/footer labels and results).
 */
export function PlpProductsModeSwitch({ className }: Readonly<PlpProductsModeSwitchProps>) {
  const { mode, canToggleAllProducts } = useProductsMode();

  if (!canToggleAllProducts) {
    return null;
  }

  return <PlpProductsModeSwitchControl checked={mode === 'all'} className={className} />;
}

/** Inner control — only mounted when the switch is available, so router/logger hooks stay out of anonymous renders. */
function PlpProductsModeSwitchControl({ checked, className }: Readonly<{ checked: boolean; className?: string }>) {
  const t = useTranslations('search.searchResults');
  const router = useRouter();
  const logger = useLogger();
  const siteCode = useSiteCode();
  const radioName = useId();
  const [pending, setPending] = useState(false);

  const handleSelect = async (nextMode: 'all' | 'assigned') => {
    const nextChecked = nextMode === 'all';
    if (nextChecked === checked || pending) {
      return;
    }

    setPending(true);

    try {
      const result = await setProductsMode(nextMode, siteCode);

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
    <div
      role="radiogroup"
      aria-label={t('productsModeSwitchLabel')}
      data-testid="plp-productsModeSwitch"
      className={cn(
        'inline-flex max-w-full min-w-0 shrink-0 items-center overflow-hidden rounded-full border border-border-action p-0.5',
        className,
      )}
    >
      <ModeOption
        checked={!checked}
        disabled={pending}
        label={t('assignedProductsShort')}
        name={radioName}
        testId="plp-productsModeAssigned"
        value="assigned"
        onSelect={() => void handleSelect('assigned')}
      />
      <ModeOption
        checked={checked}
        disabled={pending}
        label={t('allProductsShort')}
        name={radioName}
        testId="plp-productsModeAll"
        value="all"
        onSelect={() => void handleSelect('all')}
      />
    </div>
  );
}

function ModeOption({
  checked,
  disabled,
  label,
  name,
  testId,
  value,
  onSelect,
}: Readonly<{
  checked: boolean;
  disabled: boolean;
  label: string;
  name: string;
  testId: string;
  value: 'assigned' | 'all';
  onSelect: () => void;
}>) {
  return (
    <label
      className={cn(
        'inline-flex min-w-0 cursor-pointer items-center justify-center rounded-full px-1.5 py-0.5 uppercase',
        'has-[:focus-visible]:ring-border-focus has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2',
        checked
          ? 'bg-surface-action font-headlines text-sm font-bold text-text-on-action'
          : 'font-bold text-sm text-text-action',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        className="sr-only"
        data-testid={testId}
        onChange={onSelect}
      />
      <span className="truncate" title={label} data-testid={checked ? 'plp-productsModeLabel' : undefined}>
        {label}
      </span>
    </label>
  );
}

export default PlpProductsModeSwitch;
