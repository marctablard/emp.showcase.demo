import type { HTMLAttributes } from 'react';
import Image from 'next/image';
import { H3 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ColumnTeaserData, ColumnTeaserImageData } from './schema';

type ImageWithHoverProps = {
  image: ColumnTeaserImageData;
  className?: string;
};

const ImageWithHover = ({ image, className = '' }: ImageWithHoverProps) => {
  const imageElement = (
    <div className={cn('relative overflow-hidden group', className)}>
      <Image
        src={image.filename}
        alt={image.alt || image.title || 'Image'}
        fill
        className="object-cover transition-all duration-300 group-hover:scale-105"
      />
      {/* Blue overlay on hover */}
      <div className="absolute inset-0 bg-surface-action group-hover:bg-surface-action-hover transition-all duration-300" />
      {image.title && (
        <div className="absolute bottom-4 left-4 right-4">
          <H3
            variant="h5"
            className="text-text-on-action shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            {image.title}
          </H3>
        </div>
      )}
    </div>
  );

  if (image.link) {
    return (
      <Link href={image.link} className="block h-full">
        {imageElement}
      </Link>
    );
  }

  return imageElement;
};

export type ColumnTeaserProps = ColumnTeaserData & HTMLAttributes<HTMLDivElement>;

const ColumnTeaser = ({ id: _id, type: _type, main_image, side_images, className, ...rest }: ColumnTeaserProps) => {
  const mainImg = main_image;
  const sideImgs = side_images || [];

  return (
    <div className={cn('w-full max-w-6xl mx-auto mb-10', className)} {...rest}>
      <div className="grid grid-cols-2 gap-4 h-auto ">
        {mainImg && (
          <div className="col-span-2 md:col-span-1 h-96">
            <ImageWithHover image={mainImg} className="w-full h-full" />
          </div>
        )}

        {sideImgs.length > 0 && (
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            {sideImgs.slice(0, 3).map((image, index) => (
              <div key={index} className="flex-1 h-20 md:h-auto min-h-[80px]">
                <ImageWithHover image={image} className="w-full h-full" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColumnTeaser;
