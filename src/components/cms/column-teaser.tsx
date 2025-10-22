'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';

/**
 * Column Teaser component for displaying four images in a specific layout:
 * - One large image on the left
 * - Three smaller images on the right (stacked)
 * - Responsive: on smaller screens, the three images wrap below the first one
 * - Hover effect: blue filter overlay
 */

interface ImageData {
  filename: string;
  alt?: string;
  link?: string;
  title?: string;
}

interface ColumnTeaserProps {
  main_image?: ImageData;
  side_images?: ImageData[];
}

const ColumnTeaser = ({ main_image, side_images }: ColumnTeaserProps) => {
  // Support both Storyblok and direct props
  const mainImg = main_image;
  const sideImgs = side_images || [];

  const ImageWithHover = ({ image, className = '' }: { image: ImageData; className?: string }) => {
    const imageElement = (
      <div className={`relative overflow-hidden group ${className}`}>
        <Image
          src={image.filename}
          alt={image.alt || image.title || 'Image'}
          fill
          className="object-cover transition-all duration-300 group-hover:scale-105"
        />
        {/* Blue overlay on hover */}
        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/40 transition-all duration-300 backdrop-blur-[0px] group-hover:backdrop-blur-[1px]" />
        {image.title && (
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-white font-bold text-lg drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {image.title}
            </h3>
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

  return (
    <div className="w-full max-w-6xl mx-auto mb-10">
      <div className="grid grid-cols-2 gap-4 h-auto ">
        {/* Main image - left side */}
        {mainImg && (
          <div className="col-span-2 lg:col-span-1 h-96">
            <ImageWithHover image={mainImg} className="w-full h-full" />
          </div>
        )}

        {/* Side images - right side */}
        {sideImgs.length > 0 && (
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-4">
            {sideImgs.slice(0, 3).map((image, index) => (
              <div key={index} className="flex-1 h-20 lg:h-auto min-h-[80px]">
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
