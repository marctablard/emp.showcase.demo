'use client';

import React from 'react';
import { ReturnData, ReturnDetailsData } from '../types';
import { ReturnCard } from './ReturnCard';

interface ReturnDetailsRendererProps {
  data: ReturnDetailsData;
}

export const ReturnDetailsRenderer: React.FC<ReturnDetailsRendererProps> = ({ data }) => {
  let returnItem: ReturnData | undefined = data.return;

  if (!returnItem && data.returns && Array.isArray(data.returns) && data.returns.length === 1) {
    returnItem = data.returns[0];
  }

  if (!returnItem) {
    return null;
  }

  return (
    <div className="space-y-4">
      {data.message && <div className="text-text-body mb-3 text-base">{data.message}</div>}
      <ReturnCard returnItem={returnItem} />
    </div>
  );
};
