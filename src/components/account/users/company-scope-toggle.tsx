'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const COMPANY_SCOPE_RADIO_NAME = 'company-scope';

interface CompanyScopeToggleProps {
  currentCompanyName?: string;
  showAllCompanies: boolean;
  currentCompanyDisabled?: boolean;
  onShowAllCompaniesChange: (showAllCompanies: boolean) => void;
}

/**
 * Figma 184:94269 / Segmented Control 192:16583 — current company / All companies.
 * COP-4807: replaces the Q26 “show users from my other companies” checkbox.
 */
export function CompanyScopeToggle({
  currentCompanyName,
  showAllCompanies,
  currentCompanyDisabled = false,
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
        disabled={currentCompanyDisabled}
        label={companyLabel}
        value="current"
        className="max-w-48"
        onSelect={() => onShowAllCompaniesChange(false)}
      />
      <ScopeOption
        checked={showAllCompanies}
        label={t('allCompanies')}
        value="all"
        onSelect={() => onShowAllCompaniesChange(true)}
      />
    </div>
  );
}

function ScopeOption({
  checked,
  disabled,
  label,
  value,
  className,
  onSelect,
}: Readonly<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  value: 'current' | 'all';
  className?: string;
  onSelect: () => void;
}>) {
  return (
    <label
      className={cn(
        'inline-flex min-w-0 items-center justify-center rounded-full px-2 py-1 uppercase',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        'has-[:focus-visible]:ring-border-focus has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2',
        checked
          ? 'bg-surface-action font-headlines text-action-button tracking-[var(--desktop-spacing-action-button)] text-text-on-action'
          : 'font-bold text-base leading-6 text-text-action',
        className,
      )}
    >
      <input
        type="radio"
        name={COMPANY_SCOPE_RADIO_NAME}
        value={value}
        checked={checked}
        disabled={disabled}
        className="sr-only"
        onChange={() => {
          if (disabled) {
            return;
          }
          onSelect();
        }}
      />
      <span className="truncate">{label}</span>
    </label>
  );
}
