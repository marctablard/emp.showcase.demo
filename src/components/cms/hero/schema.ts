import { z } from 'zod';
import { ButtonSchema } from '../button/schema';

const TextLeafSchema = z.object({
  text: z.string(),
});

const TextEditorBlockSchema = z.object({
  type: z.string(),
  content: z.array(TextLeafSchema),
});

const TextEditorDataSchema = z.object({
  content: z.array(TextEditorBlockSchema),
});

export type TextEditorData = z.infer<typeof TextEditorDataSchema>;

const VideoFileSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

const VideoBlokSchema = z.object({
  id: z.string(),
  type: z.literal('video'),
  video_file: VideoFileSchema,
  autoplay: z.boolean(),
  loop: z.boolean().optional(),
  mute: z.boolean().optional(),
  controls: z.boolean().optional(),
  alt_text: z.string().optional(),
});

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
  video: z.array(VideoBlokSchema).optional(),
});

export type HeroData = z.infer<typeof HeroSchema>;
