'use client';

import Image from 'next/image';
import { storyblokEditable } from '@storyblok/react/rsc';
import { H2 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';

/**
 * ContentBlock component for Storyblok
 * A multi-purpose content item that can be placed on various pages
 */
interface ContentBlockProps {
  blok: {
    title?: string;
    description?: string;
    images?: Array<{
      filename: string;
      alt?: string;
    }>;
    background_image?: {
      filename: string;
      alt?: string;
    };
    button?: {
      name?: string;
      link?: string;
      is_external?: boolean;
    };
    style?: 'full-width' | 'vignette' | 'teaser';
  };
}

const ContentBlock = ({ blok }: ContentBlockProps) => {
  // Define classes based on style
  const containerClasses = {
    'full-width': 'w-full',
    vignette: 'max-w-4xl mx-auto rounded-md shadow-lg overflow-hidden',
    teaser: 'max-w-sm rounded-md shadow-md overflow-hidden',
  }[blok.style || 'full-width'];

  // Determine if button is external
  const isExternalButton = blok.button?.is_external || (blok.button?.link && blok.button.link.startsWith('http'));

  // Button href
  const buttonHref = blok.button?.link || '#';

  return (
    <div {...storyblokEditable(blok)} className={`content-block relative ${containerClasses} my-8`}>
      {/* Background image if provided */}
      {blok.background_image?.filename && (
        <div className="absolute inset-0 z-0">
          <Image
            src={blok.background_image.filename}
            alt={blok.background_image?.alt || ''}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-surface-neutral bg-opacity-40"></div>
        </div>
      )}

      {/* Content */}
      <div className={`relative z-10 p-8 ${blok.background_image?.filename ? 'text-text-on-action' : ''}`}>
        {blok.title && (
          <H2 variant="h6" className="mb-4">
            {blok.title}
          </H2>
        )}

        {blok.description && <div className="mb-6">{blok.description}</div>}

        {/* Images */}
        {blok.images && blok.images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {blok.images.map((image, index) => (
              <div key={index} className="relative h-48">
                <Image src={image.filename} alt={image.alt || ''} fill className="object-cover rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Button */}
        {blok.button?.name &&
          (isExternalButton ? (
            <a
              href={buttonHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-surface-action text-text-on-action rounded hover:bg-surface-action-hover transition-colors"
            >
              {blok.button.name}
            </a>
          ) : (
            <Link
              href={buttonHref}
              className="inline-block px-6 py-2 bg-surface-action text-text-on-action rounded hover:bg-surface-action-hover transition-colors"
            >
              {blok.button.name}
            </Link>
          ))}
      </div>
    </div>
  );
};

export default ContentBlock;
