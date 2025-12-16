import { ArrowLeft, ArrowRight } from 'lucide-react';
import UiLink from '../ui/link';

const IconVariant = {
  ArrowRight: ArrowRight,
  ArrowLeft: ArrowLeft,
} as const;

export interface ButtonData {
  title: string;
  link: string;
  iconLeft?: string;
  iconRight?: string;
}

export interface ButtonProps {
  title: string;
  link: string;
  iconLeft?: string;
  iconRight?: string;
}

const Button = ({ title, link, iconLeft, iconRight }: ButtonProps) => {
  const IconLeft = iconLeft && IconVariant[iconLeft as keyof typeof IconVariant];
  const IconRight = iconRight && IconVariant[iconRight as keyof typeof IconVariant];

  return (
    <div>
      <UiLink type="Link" variant="buttonPrimary" href={link}>
        {IconLeft && <IconLeft />}
        {title}
        {IconRight && <IconRight />}
      </UiLink>
    </div>
  );
};

export default Button;
