'use client';

import Image from 'next/image';
import { Heading } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { ButtonData } from '../button';
import Button from '../button';
import type { TextEditorData } from './hero';

interface ContentItemCenteredProps {
  headline?: string;
  text?: TextEditorData;
  main_button?: ButtonData[];
  image: {
    filename: string;
    alt?: string;
  };
  isFirstOnPage?: boolean;
}

const ContentItemCentered = ({
  headline,
  text,
  main_button,
  image,
  isFirstOnPage = false,
}: ContentItemCenteredProps) => {
  const button = main_button ? main_button[0] : null;
  const textContent = text?.content?.[0]?.content?.[0]?.text || '';

  return (
    <div className={cn('w-full max-w-6xl mx-auto px-4 lg:px-9 py-8', isFirstOnPage && 'pt-17 sm:pt-36 md:pt-52')}>
      <div
        className={cn(
          'relative flex flex-col items-center gap-6 p-6 sm:p-8 rounded-lg',
          'lg:bg-[url("/images/hero-pattern.svg")] bg-no-repeat bg-left-top',
          'bg-gray-50',
        )}
      >
        {(headline || textContent) && (
          <div className="w-full flex flex-col items-center gap-4 text-center">
            {headline && (
              <Heading variant="h2" as="div">
                {headline}
              </Heading>
            )}
            {textContent && <p className="text-base md:text-lg text-text-body">{textContent}</p>}
          </div>
        )}
        {image && (
          <div className="w-full relative overflow-hidden rounded-lg">
            <Image src={image.filename} alt={image?.alt || ''} className="w-full h-auto" width={1152} height={648} />
          </div>
        )}
        {button && (
          <div className="w-full flex justify-center">
            <Button {...button} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentItemCentered;
