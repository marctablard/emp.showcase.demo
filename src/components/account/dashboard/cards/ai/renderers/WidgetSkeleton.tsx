'use client';

import React from 'react';

interface WidgetSkeletonProps {
  rows?: number;
}

export const WidgetSkeleton: React.FC<WidgetSkeletonProps> = ({ rows = 2 }) => {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-24 rounded-xl border border-border-primary bg-surface-primary animate-pulse" />
      ))}
    </div>
  );
};

export const widgetOrSkeleton = (value: unknown, children: React.ReactNode, rows = 2): React.ReactNode => {
  if (value == null) {
    return <WidgetSkeleton rows={rows} />;
  }
  return children;
};
