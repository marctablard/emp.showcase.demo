'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { Heading } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { ButtonData } from '../button';
import Button from '../button';
import type { VideoData } from '../video';
import Video from '../video';
import type { TextEditorData } from './hero';

export enum ImagePosition {
  Right = 'Right',
  Left = 'Left',
}

interface ContentItemMediaTextProps {
  overline?: string;
  headline: string;
  text: TextEditorData;
  main_button?: ButtonData[];
  image: {
    filename: string;
    alt?: string;
  };
  video?: VideoData[];
  has_background?: boolean;
  image_position: ImagePosition | 'Left' | 'Right';
  isFirstOnPage?: boolean;
}

const ContentItemMediaText = ({
  overline,
  headline,
  text,
  main_button,
  image,
  video,
  has_background,
  image_position,
  isFirstOnPage = false,
}: ContentItemMediaTextProps) => {
  const button = main_button ? main_button[0] : null;
  const textContent = text?.content?.[0]?.content?.[0]?.text || '';
  const videoData = video?.[0];
  const videoContainer = useRef<HTMLDivElement>(null);
  const videoPlayer = useRef<HTMLDivElement>(null);
  const videoControls = useRef<HTMLDivElement>(null);

  const isLeft = image_position === ImagePosition.Left || String(image_position) === 'Left';
  const isRight = image_position === ImagePosition.Right || String(image_position) === 'Right';

  const handleVideoPlay = () => {
    videoPlayer?.current?.querySelector('video')?.play();
    videoContainer?.current?.querySelector('img')?.classList.add('hidden');
    videoPlayer?.current?.classList.remove('hidden');
    videoControls?.current?.classList.add('hidden');
  };

  return (
    <div
      className={cn(
        'flex gap-5 align-center py-8',
        isFirstOnPage && 'pt-17 sm:pt-36 md:pt-52',
        has_background && 'bg-surface-action-hover-2',
        has_background && isRight && 'bg-[url("/images/text-media-left-bg.svg")] bg-no-repeat bg-left-top',
        has_background && isLeft && 'bg-right-top bg-[url("/images/text-media-right-bg.svg")] bg-no-repeat',
      )}
    >
      <div className={cn('w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-6xl mx-auto')}>
        <div
          className={cn(
            'row-start-2 sm:row-span-2',
            isLeft && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
            isRight && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            'content-center rounded-ss-2xl rounded-ee-2xl',
          )}
        >
          {image && (
            <div className="w-full m-auto rounded-[inherit] relative overflow-hidden" ref={videoContainer}>
              {!videoData?.autoplay && (
                <Image
                  src={image.filename}
                  alt={image?.alt || ''}
                  className="w-full h-auto rounded-[inherit]"
                  width={920}
                  height={518}
                />
              )}
              {video && (
                <div className="hidden" ref={videoPlayer}>
                  <Video {...video[0]} controls={true} />
                </div>
              )}
              {video && videoData?.controls && !videoData?.autoplay && (
                <div
                  className="absolute flex rounded-full shadow-sm backdrop-blur-default w-40 h-40 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer mr-9 mb-14 p-3 text-icon-on-action bg-surface-action transition hover:bg-surface-action-hover"
                  onClick={handleVideoPlay}
                  ref={videoControls}
                >
                  <Play className="w-full h-full p-6" />
                </div>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            'col-start-1 row-start-1 content-end',
            isLeft && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            isRight && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
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
            isLeft && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            isRight && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
          )}
        >
          <p className="text-base md:text-lg text-text-body pb-4">{textContent}</p>
          {button && <Button {...button} />}
        </div>
      </div>
    </div>
  );
};

export default ContentItemMediaText;
