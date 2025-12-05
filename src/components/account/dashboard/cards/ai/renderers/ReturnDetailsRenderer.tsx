'use client';

import React from 'react';
import { ReturnCard } from './ReturnCard';

interface ReturnDetailsRendererProps {
  data: any;
}

export const ReturnDetailsRenderer: React.FC<ReturnDetailsRendererProps> = ({ data }) => {
  let returnItem = data.return || data;

  if (data.returns && Array.isArray(data.returns) && data.returns.length === 1) {
    returnItem = data.returns[0];
  }

  return (
    <div className="space-y-4">
      {data.message && <div className="text-text-body mb-3 text-base">{data.message}</div>}
      <ReturnCard returnItem={returnItem} />
    </div>
  );
};
