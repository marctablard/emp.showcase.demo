'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { SkeletonFrame } from '@/components/ui/skeleton-frame';

interface WidgetSkeletonProps {
  rows?: number;
}

export const WidgetSkeleton: React.FC<WidgetSkeletonProps> = ({ rows = 2 }) => {
  const t = useTranslations('account.AiHelper');

  return (
    <>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonFrame key={index} className="h-24" rounded="xl" />
        ))}
      </div>
      <output className="sr-only">{t('aiProcessing')}</output>
    </>
  );
};

export const widgetOrSkeleton = (value: unknown, children: React.ReactNode, rows = 2): React.ReactNode => {
  if (value == null) {
    return <WidgetSkeleton rows={rows} />;
  }
  return children;
};
