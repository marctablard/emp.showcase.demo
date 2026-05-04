import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { cn } from '@/lib/utils';
import { type SharedImage, resolveImageSrc, sharedFieldDefinitions } from './_shared/field-definitions';
import { type Radius, radiusClass } from './_shared/styles';

type Aspect = 'video' | 'wide' | 'square';

type VideoBlockProps = {
  src?: string;
  poster?: SharedImage;
  caption?: string;
  aspect?: Aspect;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  radius?: Radius;
};

const aspectClass = (aspect?: Aspect) => {
  switch (aspect) {
    case 'wide':
      return 'aspect-[21/9]';
    case 'square':
      return 'aspect-square';
    case 'video':
    default:
      return 'aspect-video';
  }
};

export default function VideoBlock({
  src,
  poster,
  caption,
  aspect = 'video',
  autoplay = false,
  loop = false,
  muted = false,
  controls = true,
  radius = 'md',
}: VideoBlockProps) {
  if (!src) return null;
  return (
    <figure data-cms="video" className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 md:px-12">
      <div
        className={cn(
          'relative w-full overflow-hidden bg-surface-image-background',
          aspectClass(aspect),
          radiusClass(radius),
        )}
      >
        <video
          src={src}
          poster={resolveImageSrc(poster)}
          autoPlay={autoplay}
          loop={loop}
          muted={muted || autoplay}
          controls={controls}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {caption ? <figcaption className="text-sm text-text-placeholders">{caption}</figcaption> : null}
    </figure>
  );
}

export const videoEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-video',
    label: 'Video',
    description: 'Self-hosted or external video. URL must point at a playable video file.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      src: { label: 'Video URL', type: 'url', required: true },
      poster: { $ref: 'image', label: 'Poster image', type: 'object' },
      caption: { label: 'Caption', type: 'text' },
      aspect: {
        label: 'Aspect ratio',
        type: 'select',
        options: [
          { label: 'Video (16:9)', value: 'video' },
          { label: 'Wide (21:9)', value: 'wide' },
          { label: 'Square', value: 'square' },
        ],
      },
      autoplay: { label: 'Autoplay', type: 'boolean' },
      loop: { label: 'Loop', type: 'boolean' },
      muted: { label: 'Muted', type: 'boolean' },
      controls: { label: 'Show controls', type: 'boolean' },
      radius: {
        label: 'Corner radius',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
    defaultProps: { aspect: 'video', autoplay: false, loop: false, muted: false, controls: true, radius: 'md' },
  },
  mapProps: (p) => ({
    src: p.src,
    poster: p.poster,
    caption: p.caption,
    aspect: p.aspect,
    autoplay: p.autoplay,
    loop: p.loop,
    muted: p.muted,
    controls: p.controls,
    radius: p.radius,
  }),
  component: VideoBlock,
};
