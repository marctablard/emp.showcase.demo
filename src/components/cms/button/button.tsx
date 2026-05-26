import type { HTMLAttributes } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { cn } from '@/lib/utils';
import type { ButtonData } from './schema';

const IconVariant = {
  ArrowRight: ArrowRight,
  ArrowLeft: ArrowLeft,
} as const;

export type ButtonProps = ButtonData & HTMLAttributes<HTMLDivElement>;

const Button = ({ id: _id, type: _type, title, link, iconLeft, iconRight, className, ...rest }: ButtonProps) => {
  const IconLeft = iconLeft && IconVariant[iconLeft as keyof typeof IconVariant];
  const IconRight = iconRight && IconVariant[iconRight as keyof typeof IconVariant];

  return (
    <div className={cn(className)} {...rest}>
      <UiLink type="Link" variant="buttonPrimary" href={link}>
        {IconLeft && <IconLeft />}
        {title}
        {IconRight && <IconRight />}
      </UiLink>
    </div>
  );
};

export default Button;
