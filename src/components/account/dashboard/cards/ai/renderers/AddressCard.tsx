'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface AddressCardProps {
  address: {
    name: string;
    company?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    tags?: string[];
  };
}

export const AddressCard: React.FC<AddressCardProps> = ({ address }) => {
  return (
    <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start rounded-xl border border-border-primary p-4 flex flex-col h-full shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-base font-bold text-text-on-action">{address.name}</h4>
          {address.company && <div className="text-sm text-text-on-action/90 mt-1">{address.company}</div>}
        </div>
      </div>

      <div className="space-y-1 text-sm text-text-on-action/90 flex-grow">
        <div>{address.addressLine1}</div>
        {address.addressLine2 && <div>{address.addressLine2}</div>}
        <div>
          {address.city}, {address.state} {address.postalCode}
        </div>
        <div>{address.country}</div>
      </div>

      {address.tags && address.tags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-primary/30">
          <div className="flex items-center flex-wrap gap-1">
            <span className="text-text-on-action/80 text-xs">🔖</span>
            {address.tags.map((tag: string, tagIndex: number) => (
              <Badge
                key={tagIndex}
                variant="outline"
                rounded="default"
                className="text-xs bg-surface-action/30 text-text-on-action border-text-on-action/30"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
