import type { HTMLAttributes } from 'react';
import { Heading } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { extractTipTapText } from '../_shared/text-editor.schema';
import Button from '../button';
import MediaTextMedia from './media-text-media';
import type { MediaTextData } from './schema';

export type MediaTextProps = MediaTextData & HTMLAttributes<HTMLDivElement>;

const MediaText = ({
  id: _id,
  type: _type,
  overline,
  headline,
  text,
  main_button,
  image,
  video,
  has_background,
  image_position,
  className,
  ...rest
}: Readonly<MediaTextProps>) => {
  const button = main_button ? main_button[0] : null;
  const textContent = extractTipTapText(text);

  return (
    <div
      className={cn(
        'flex gap-5 align-center py-8',
        has_background && 'bg-surface-action-hover-2',
        has_background &&
          image_position === 'Right' &&
          ' bg-[url("/images/text-media-left-bg.svg")] bg-no-repeat bg-left-top',
        has_background &&
          image_position === 'Left' &&
          'bg-right-top bg-[url("/images/text-media-right-bg.svg")] bg-no-repeat ',
        className,
      )}
      {...rest}
    >
      <div className={cn('w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-6xl mx-auto')}>
        <div
          className={cn(
            'row-start-2 sm:row-span-2',
            image_position === 'Left' && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
            image_position === 'Right' && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            'content-center rounded-ss-2xl rounded-ee-2xl',
          )}
        >
          <MediaTextMedia image={image} video={video} />
        </div>
        <div
          className={cn(
            'col-start-1 row-start-1 content-end',
            image_position === 'Left' && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            image_position === 'Right' && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
          )}
        >
          {overline && (
            <Heading variant="overline" as="div" className="mb-3">
              {overline}
            </Heading>
          )}
          {headline && (
            <Heading variant="h2" as="div">
              {headline}
            </Heading>
          )}
        </div>
        <div
          className={cn(
            'col-start-1',
            image_position === 'Left' && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            image_position === 'Right' && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
          )}
        >
          <p className=" text-base md:text-lg text-text-body pb-4">{textContent}</p>
          {button && <Button {...button} />}
        </div>
      </div>
    </div>
  );
};

export default MediaText;
