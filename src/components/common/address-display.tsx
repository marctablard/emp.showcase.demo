'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import type { Address } from '@/platform/services/model/common';

interface AddressDisplayProps {
  address: Address;
  className?: string;
}

/**
 * Individual address card component
 */
export function AddressDisplay({ address, className }: AddressDisplayProps) {
  return (
    <div className={`flex items-start space-x-2 ${className}`}>
      <MapPin className="h-4 w-4 mt-1 text-icon-secondary" />
      <div className="space-y-1">
        {address.companyName && <p>{address.companyName}</p>}
        {address.contactName && <p>{address.contactName}</p>}
        {address.street ? <p>{address.street}</p> : null}
        {address.streetNumber ? <p className="tabular-nums">{address.streetNumber}</p> : null}
        <p>
          {address.zipCode} {address.city}
        </p>
        <p>{address.country}</p>
        {address.contactPhone && <p>{address.contactPhone}</p>}
      </div>
    </div>
  );
}
