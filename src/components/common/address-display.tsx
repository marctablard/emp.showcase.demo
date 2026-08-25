'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div className={cn('flex min-w-0 items-start gap-2', className)}>
      <MapPin className="mt-1 size-4 shrink-0 text-icon-secondary" aria-hidden />
      <div className="min-w-0 space-y-1 wrap-break-word">
        {address.companyName && <p>{address.companyName}</p>}
        {address.contactName && <p className="break-all">{address.contactName}</p>}
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
