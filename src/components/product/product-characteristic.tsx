import { cn } from '@/lib/utils';

interface ProductCharacteristicProps {
  readonly value: string | number;
  readonly unit: string;
  readonly className?: string;
}

export function ProductCharacteristic({ value, unit, className }: ProductCharacteristicProps) {
  return (
    <div className={cn('flex min-w-0 max-w-full flex-col overflow-hidden rounded-sm border', className)}>
      <div className="bg-surface-neutral px-1 py-0.5 text-center text-sm leading-tight text-text-on-action break-words whitespace-normal">
        {value}
      </div>
      <div className="bg-surface-page px-1 py-0.5 text-center text-sm leading-tight break-words whitespace-normal">
        {unit}
      </div>
    </div>
  );
}
