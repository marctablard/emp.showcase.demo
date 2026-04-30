'use client';

import { useEffect, useRef, useState } from 'react';
import { CirclePause, CirclePlay } from 'lucide-react';
import { H1 } from '@/components/ui/h';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import type { ButtonData } from '../button';
import Button from '../button';
import type { VideoData } from '../video';
import Video from '../video';

export interface TextEditorData {
  content: [
    {
      text: string;
      type: string;
      content: [
        {
          text: string;
        },
      ];
    },
  ];
}

interface HeroProps {
  headline: string;
  text: TextEditorData;
  main_button: ButtonData[];
  image: {
    filename: string;
    alt?: string;
  };
  video?: VideoData[];
  showOverlay?: boolean;
}

const Hero = ({ headline, text, main_button, image, video, showOverlay = true }: HeroProps) => {
  const button = main_button?.[0];
  const videoData = video?.[0];
  const content = text?.content?.[0]?.content?.[0]?.text;
  const isAboveSmallScreen = useBreakpoint('sm');
  const videoPlayer = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(videoData?.autoplay);

  useEffect(() => {
    videoPlayer?.current?.querySelector('video')?.addEventListener('ended', () => {
      setIsPlaying(false);
    });
  });

  const handleVideoPlay = () => {
    if (isPlaying) {
      videoPlayer?.current?.querySelector('video')?.pause();
      setIsPlaying(false);
    } else {
      videoPlayer?.current?.querySelector('video')?.play();
      setIsPlaying(true);
    }
  };

  return (
    <div
      className={cn(
        'relative mb-10 sm:mb-20 md:mb-10',
        'lg:bg-[url("/images/hero-pattern.svg")] bg-no-repeat bg-left-top',
      )}
    >
      <div className="w-full">
        <div className="mb-44 sm:mb-0 h-100 sm:h-145 md:h-185 w-full overflow-hidden">
          {image && !videoData?.autoplay && (
            <img src={image.filename} alt={image.alt || ''} className="w-full h-full object-cover" />
          )}
          {video && (
            <div className="w-full h-full" ref={videoPlayer}>
              <Video {...video[0]} controls={false} />
            </div>
          )}
        </div>
      </div>
      {showOverlay && (
        <div className="w-full max-w-6xl mx-auto">
          <div className="ml-auto absolute bottom-0 sm:-bottom-10 md:bottom-20 px-4 lg:px-9">
            {video && !isAboveSmallScreen && (
              <div
                className="flex rounded-full shadow-sm backdrop-blur-default w-12 h-12 bg-surface-page/85 cursor-pointer ml-auto mb-4 p-3 text-icon-action transition hover:text-icon-action-hover"
                onClick={handleVideoPlay}
              >
                {isPlaying ? <CirclePause /> : <CirclePlay />}
              </div>
            )}
            <div className="flex flex-col gap-4 bg-surface-page/85 sm:w-1/2 lg:w-4/7 rounded-tl-lg sm:rounded-tl-2xl rounded-br-lg sm:rounded-br-2xl shadow-sm p-4 sm:p-6 backdrop-blur-default">
              <H1>{headline}</H1>
              <div className="w-20 h-2 bg-surface-action rounded-full"></div>
              <p className="text-base md:text-lg text-text-body">{content}</p>
              {button && <Button {...button} />}
            </div>
          </div>
          {video && isAboveSmallScreen && (
            <div
              className="absolute flex rounded-full shadow-sm backdrop-blur-default w-12 h-12 bg-surface-page/85 right-0 bottom-0 cursor-pointer mr-9 mb-14 p-3 text-icon-action transition hover:text-icon-action-hover"
              onClick={handleVideoPlay}
            >
              {isPlaying ? <CirclePause /> : <CirclePlay />}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Hero;
