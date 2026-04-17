'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { storyblokEditable } from '@storyblok/react/rsc';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Heading } from '../ui/h';
import type { ButtonData } from './button';
import Button from './button';
import type { TextEditorData } from './hero';
import type { VideoData } from './video';
import Video from './video';

export enum ImagePosition {
  Right = 'Right',
  Left = 'Left',
}

interface MediaTextProps {
  blok: {
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
    image_position: ImagePosition;
  };
}

const MediaText = ({ blok }: MediaTextProps) => {
  const button = blok.main_button ? blok.main_button[0] : null;
  const text = blok.text.content[0].content[0].text;
  const video = blok.video?.[0];
  const videoContainer = useRef<HTMLDivElement>(null);
  const videoPlayer = useRef<HTMLDivElement>(null);
  const videoControls = useRef<HTMLDivElement>(null);

  const handleVideoPlay = () => {
    videoPlayer?.current?.querySelector('video')?.play();
    videoContainer?.current?.querySelector('img')?.classList.add('hidden');
    videoPlayer?.current?.classList.remove('hidden');
    videoControls?.current?.classList.add('hidden');
  };

  return (
    <div
      {...storyblokEditable(blok)}
      className={cn(
        'flex gap-5 align-center py-8',
        blok.has_background && 'bg-surface-action-hover-2',
        blok.has_background &&
          blok.image_position === ImagePosition.Right &&
          ' bg-[url("/images/text-media-left-bg.svg")] bg-no-repeat bg-left-top',
        blok.has_background &&
          blok.image_position === ImagePosition.Left &&
          'bg-right-top bg-[url("/images/text-media-right-bg.svg")] bg-no-repeat ',
      )}
    >
      <div className={cn('w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-6xl mx-auto')}>
        <div
          className={cn(
            'row-start-2 sm:row-span-2',
            blok.image_position === ImagePosition.Left && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
            blok.image_position === ImagePosition.Right && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            'content-center rounded-ss-2xl rounded-ee-2xl',
          )}
        >
          {blok.image && (
            <div className="w-full m-auto rounded-[inherit] relative overflow-hidden" ref={videoContainer}>
              {!video?.autoplay && (
                <Image
                  src={blok.image.filename}
                  alt={blok.image?.alt || ''}
                  className="w-full h-auto rounded-[inherit]"
                  width={920}
                  height={518}
                />
              )}
              {video && (
                <div className="hidden" ref={videoPlayer}>
                  <Video {...video} controls={true} />
                </div>
              )}
              {video && video?.controls && !video?.autoplay && (
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
            blok.image_position === ImagePosition.Left && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            blok.image_position === ImagePosition.Right && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
          )}
        >
          {blok.overline && (
            <Heading variant="overline" as="div" className="mb-3">
              {blok.overline}
            </Heading>
          )}
          {blok.headline && (
            <Heading variant="h2" as="div">
              {blok.headline}
            </Heading>
          )}
        </div>
        <div
          className={cn(
            'col-start-1',
            blok.image_position === ImagePosition.Left && 'sm:col-start-2 ml-4 sm:ml-0 mr-4 lg:mr-9',
            blok.image_position === ImagePosition.Right && 'sm:col-start-1 mr-4 sm:mr-0 ml-4 lg:ml-9',
          )}
        >
          <p className=" text-base md:text-lg text-text-body pb-4">{text}</p>
          {button && <Button {...button} />}
        </div>
      </div>
    </div>
  );
};

export default MediaText;
