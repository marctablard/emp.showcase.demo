'use client';

import { useEffect, useRef, useState } from 'react';
import { CirclePause, CirclePlay } from 'lucide-react';
import { H1 } from '@/components/ui/h';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import Button, { ButtonData } from './button';
import Video, { VideoData } from './video';

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
}

const Hero = ({ headline, text, main_button, image, video }: HeroProps) => {
  const button = main_button?.[0];
  const videoData = video?.[0];
  const content = text?.content?.[0]?.content?.[0].text;
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
        'max-w-[2500px] mx-auto',
      )}
    >
      <div className="w-full flex justify-end">
        <div className="mb-44 sm:mb-0 h-100 sm:h-145 md:h-185 w-full sm:w-auto">
          {image && (
            <svg className="h-full w-full sm:w-auto" viewBox={isAboveSmallScreen ? '0 0 1573 735' : '0 500 1573 735'}>
              <defs>
                <clipPath id="shape">
                  <path
                    className="hidden sm:block"
                    d="M575.995 711.064L0.5 0H1572.5V525.401C1572.5 556.733 1549.82 583.458 1518.9 588.55L636.144 733.95C613.438 737.69 590.472 728.952 575.995 711.064Z"
                    fill="#0F77D9"
                  />
                  <path className="w-full sm:hidden" d="M0 0H360V220L0 260V0Z" fill="#0F77D9" transform="scale(5)" />
                </clipPath>
              </defs>

              {image && !videoData?.autoplay && (
                <image clipPath="url(#shape)" xlinkHref={image.filename} className="sm:translate-x-0 sm:w-full"></image>
              )}
              {video && (
                <foreignObject clipPath="url(#shape)" className="sm:translate-x-0 w-full h-[200%] sm:h-full">
                  <div className="w-full h-full" ref={videoPlayer}>
                    <Video {...video[0]} controls={false} />
                  </div>
                </foreignObject>
              )}
            </svg>
          )}
        </div>
      </div>
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
    </div>
  );
};

export default Hero;
