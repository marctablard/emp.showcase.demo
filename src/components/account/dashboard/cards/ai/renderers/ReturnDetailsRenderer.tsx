'use client';

import React from 'react';
import type { ReturnData, ReturnDetailsData } from '../types';
import { ReturnCard } from './ReturnCard';
import { WidgetSkeleton } from './WidgetSkeleton';

interface ReturnDetailsRendererProps {
  data: ReturnDetailsData;
}

export const ReturnDetailsRenderer: React.FC<ReturnDetailsRendererProps> = ({ data }) => {
  let returnItem: ReturnData | undefined = data.return;

  if (!returnItem && data.returns && Array.isArray(data.returns) && data.returns.length === 1) {
    returnItem = data.returns[0];
  }

  return (
    <div className="space-y-4">
      {data.message && <div className="text-text-body mb-3 text-base">{data.message}</div>}
      {!returnItem ? <WidgetSkeleton rows={1} /> : <ReturnCard returnItem={returnItem} />}
    </div>
  );
};
