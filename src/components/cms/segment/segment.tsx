import type { HTMLAttributes, ReactNode } from 'react';
import { H2 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { SegmentData } from './schema';

export type SegmentProps = SegmentData &
  HTMLAttributes<HTMLElement> & {
    children?: ReactNode;
  };

const Segment = ({
  id: _id,
  type: _type,
  segment_name,
  emporix_segment_id: _emporix_segment_id,
  site: _site,
  content_blocks: _content_blocks,
  children,
  className,
  ...rest
}: Readonly<SegmentProps>) => {
  return (
    <section className={cn('segment-container my-8', className)} {...rest}>
      {segment_name && <H2>{segment_name}</H2>}

      <div className="space-y-6">{children}</div>
    </section>
  );
};

export default Segment;
