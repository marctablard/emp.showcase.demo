'use client';

import React from 'react';
import { ReturnCard } from './ReturnCard';

interface ReturnListRendererProps {
  data: any;
}

export const ReturnListRenderer: React.FC<ReturnListRendererProps> = ({ data }) => {
  return (
    <div className="space-y-3">
      {data.returns &&
        data.returns.map((returnItem: any, index: number) => (
          <ReturnCard key={returnItem.id || index} returnItem={returnItem} />
        ))}
    </div>
  );
};
