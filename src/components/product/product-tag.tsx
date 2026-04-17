import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ProductTagProps {
  icon: LucideIcon;
  text: string;
}

export function ProductTag({ icon: Icon, text }: ProductTagProps) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-sm text-nowrap w-fit">
      <Icon width="20" height="20" />
      <p>{text}</p>
    </div>
  );
}
