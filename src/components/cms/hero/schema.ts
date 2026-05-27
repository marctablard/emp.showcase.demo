import { z } from 'zod';
import { TextEditorDataSchema } from '../_shared/text-editor.schema';
import { ButtonSchema } from '../button/schema';
import { VideoSchema } from '../video/schema';

const ImageSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

export const HeroSchema = z.object({
  id: z.string(),
  type: z.literal('hero'),
  headline: z.string(),
  text: TextEditorDataSchema,
  image: ImageSchema,
  main_button: z.array(ButtonSchema).optional(),
  video: z.array(VideoSchema).optional(),
});

export type HeroData = z.infer<typeof HeroSchema>;
