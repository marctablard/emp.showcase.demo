import { z } from 'zod';
import { TextEditorDataSchema } from '../_shared/text-editor.schema';
import { ButtonSchema } from '../button/schema';
import { VideoSchema } from '../video/schema';

const ImageSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

export const MediaTextSchema = z.object({
  id: z.string(),
  type: z.literal('media-text'),
  overline: z.string().optional(),
  headline: z.string(),
  text: TextEditorDataSchema,
  main_button: z.array(ButtonSchema).optional(),
  image: ImageSchema,
  video: z.array(VideoSchema).optional(),
  has_background: z.boolean().optional(),
  image_position: z.enum(['Left', 'Right']),
});

export type MediaTextData = z.infer<typeof MediaTextSchema>;
