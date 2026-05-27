import type { HTMLAttributes } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { LogoData } from './schema';

export type LogoProps = LogoData & HTMLAttributes<HTMLDivElement>;

const Logo = ({ id: _id, type: _type, site: _site, image, alt_text, className, ...rest }: LogoProps) => {
  if (!image?.filename) {
    return null;
  }

  return (
    <div className={cn('logo', className)} {...rest}>
      <Image
        src={image.filename}
        alt={alt_text || image.alt || 'Logo'}
        width={150}
        height={50}
        className="object-contain"
      />
    </div>
  );
};

export default Logo;
