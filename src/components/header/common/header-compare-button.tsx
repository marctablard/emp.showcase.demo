'use client';

import { useTranslations } from 'next-intl';
import { FlipHorizontal2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useComparison } from '@/hooks/comparison/useComparison';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function HeaderCompareButton() {
  const t = useTranslations('layout.header');
  const { count } = useComparison();

  if (count === 0) {
    return null;
  }

  const isActive = count >= 2;

  const content = (
    <div
      className={cn(
        'flex flex-col items-center min-w-12 rounded-button p-0.5 transition-colors',
        isActive
          ? 'text-icon-primary-dark hover:bg-surface-action hover:text-text-on-action cursor-pointer'
          : 'text-text-on-disabled cursor-default',
      )}
      aria-disabled={!isActive}
    >
      <div className="relative w-8 h-8">
        <FlipHorizontal2 className="w-8 h-8" />
        <Badge
          variant="info"
          rounded="full"
          className="h-5 min-w-5 px-1 tabular-nums tracking-normal absolute -top-1 -right-2"
        >
          {count}
        </Badge>
      </div>
      <p className="text-sm font-bold -mt-1">{t('compare')}</p>
    </div>
  );

  if (isActive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/compare" aria-label={t('compareCount', { count })}>
            {content}
          </Link>
        </TooltipTrigger>
        <TooltipContent>{t('compareTooltip', { count })}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{content}</span>
      </TooltipTrigger>
      <TooltipContent>{t('compareTooltipMinimum')}</TooltipContent>
    </Tooltip>
  );
}
