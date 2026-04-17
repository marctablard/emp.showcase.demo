'use client';

import React from 'react';
import type { AddressData, AddressListData } from '../types';
import { AddressCard } from './AddressCard';

interface AddressListRendererProps {
  data: AddressListData;
}

export const AddressListRenderer: React.FC<AddressListRendererProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      {data.message && <div className="text-text-body mb-3">{data.message}</div>}
      {data.addresses && data.addresses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
          {data.addresses.map((address: AddressData, index: number) => (
            <AddressCard key={index} address={address} />
          ))}
        </div>
      )}
    </div>
  );
};
