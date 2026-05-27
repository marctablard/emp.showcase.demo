import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { VideoData } from './schema';

export type VideoProps = VideoData & HTMLAttributes<HTMLDivElement>;

const Video = ({
  id: _id,
  type: _type,
  video_file,
  autoplay,
  loop,
  mute,
  controls,
  alt_text,
  className,
  ...rest
}: VideoProps) => {
  return (
    <div className={cn('w-full h-full', className)} {...rest}>
      <video
        height={'100%'}
        width={'100%'}
        muted={mute || autoplay}
        controls={controls}
        loop={loop}
        autoPlay={autoplay}
        className="w-full h-full object-cover"
        aria-label={alt_text || video_file?.alt || 'Video'}
      >
        <source src={video_file?.filename} type="video/mp4" />
      </video>
    </div>
  );
};

export default Video;
