import { z } from 'zod';

const ColumnTeaserImageSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
  link: z.string().optional(),
  title: z.string().optional(),
});

export const ColumnTeaserSchema = z.object({
  id: z.string(),
  type: z.literal('column-teaser'),
  main_image: ColumnTeaserImageSchema.optional(),
  side_images: z.array(ColumnTeaserImageSchema).optional(),
});

export type ColumnTeaserImageData = z.infer<typeof ColumnTeaserImageSchema>;
export type ColumnTeaserData = z.infer<typeof ColumnTeaserSchema>;
