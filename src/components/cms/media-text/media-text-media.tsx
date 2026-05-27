'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import Video from '../video';
import type { MediaTextData } from './schema';

type MediaTextMediaProps = {
  image: MediaTextData['image'];
  video?: MediaTextData['video'];
};

const MediaTextMedia = ({ image, video: videos }: MediaTextMediaProps) => {
  const video = videos?.[0];
  const videoContainer = useRef<HTMLDivElement>(null);
  const videoPlayer = useRef<HTMLDivElement>(null);
  const videoControls = useRef<HTMLDivElement>(null);

  const handleVideoPlay = () => {
    videoPlayer?.current?.querySelector('video')?.play();
    videoContainer?.current?.querySelector('img')?.classList.add('hidden');
    videoPlayer?.current?.classList.remove('hidden');
    videoControls?.current?.classList.add('hidden');
  };

  if (!image) {
    return null;
  }

  return (
    <div className="w-full m-auto rounded-[inherit] relative overflow-hidden" ref={videoContainer}>
      {!video?.autoplay && (
        <Image
          src={image.filename}
          alt={image.alt || ''}
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
  );
};

export default MediaTextMedia;
