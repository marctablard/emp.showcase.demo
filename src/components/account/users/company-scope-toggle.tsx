'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface CompanyScopeToggleProps {
  currentCompanyName?: string;
  showAllCompanies: boolean;
  onShowAllCompaniesChange: (showAllCompanies: boolean) => void;
}

/**
 * Figma 184:94269 / Segmented Control 192:16583 — current company / All companies.
 * COP-4807: replaces the Q26 “show users from my other companies” checkbox.
 */
export function CompanyScopeToggle({
  currentCompanyName,
  showAllCompanies,
  onShowAllCompaniesChange,
}: Readonly<CompanyScopeToggleProps>) {
  const t = useTranslations('user-management');
  const companyLabel = currentCompanyName?.trim() || t('currentCompany');

  return (
    <div
      role="radiogroup"
      aria-label={t('companyScope')}
      className="inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-full border border-border-action p-0.5"
    >
      <ScopeOption
        checked={!showAllCompanies}
        label={companyLabel}
        className="max-w-48"
        onSelect={() => onShowAllCompaniesChange(false)}
      />
      <ScopeOption
        checked={showAllCompanies}
        label={t('allCompanies')}
        onSelect={() => onShowAllCompaniesChange(true)}
      />
    </div>
  );
}

function ScopeOption({
  checked,
  label,
  className,
  onSelect,
}: Readonly<{
  checked: boolean;
  label: string;
  className?: string;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={cn(
        'inline-flex min-w-0 items-center justify-center rounded-full px-2 py-1 uppercase',
        'focus-visible:ring-border-focus focus-visible:outline-none focus-visible:ring-2',
        checked
          ? 'bg-surface-action font-headlines text-action-button tracking-[var(--desktop-spacing-action-button)] text-text-on-action'
          : 'font-bold text-base leading-6 text-text-action',
        className,
      )}
      onClick={onSelect}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
