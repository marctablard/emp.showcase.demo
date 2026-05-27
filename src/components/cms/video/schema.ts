import { z } from 'zod';

const VideoFileSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

export const VideoSchema = z.object({
  id: z.string(),
  type: z.literal('video'),
  video_file: VideoFileSchema,
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  mute: z.boolean().optional(),
  controls: z.boolean().optional(),
  alt_text: z.string().optional(),
});

export type VideoData = z.infer<typeof VideoSchema>;
