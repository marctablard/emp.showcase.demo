import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import ColumnTeaserImage from './column-teaser-image';
import type { ColumnTeaserData } from './schema';

export type ColumnTeaserProps = ColumnTeaserData & HTMLAttributes<HTMLDivElement>;

const ColumnTeaser = ({
  id: _id,
  type: _type,
  main_image,
  side_images,
  className,
  ...rest
}: Readonly<ColumnTeaserProps>) => {
  const mainImg = main_image;
  const sideImgs = side_images || [];

  return (
    <div className={cn('w-full max-w-6xl mx-auto mb-10', className)} {...rest}>
      <div className="grid grid-cols-2 gap-4 h-auto ">
        {mainImg && (
          <div className="col-span-2 md:col-span-1 h-96">
            <ColumnTeaserImage image={mainImg} className="w-full h-full" />
          </div>
        )}

        {sideImgs.length > 0 && (
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            {sideImgs.slice(0, 3).map((image) => (
              <div key={image.filename} className="flex-1 h-20 md:h-auto min-h-[80px]">
                <ColumnTeaserImage image={image} className="w-full h-full" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColumnTeaser;
