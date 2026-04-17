'use client';

import React from 'react';
import type { ReturnData, ReturnListData } from '../types';
import { ReturnCard } from './ReturnCard';

interface ReturnListRendererProps {
  data: ReturnListData;
}

export const ReturnListRenderer: React.FC<ReturnListRendererProps> = ({ data }) => {
  return (
    <div className="space-y-3">
      {data.returns &&
        data.returns.map((returnItem: ReturnData, index: number) => (
          <ReturnCard key={returnItem.id || index} returnItem={returnItem} />
        ))}
    </div>
  );
};
