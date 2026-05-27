import { z } from 'zod';

export const TeaserSchema = z.object({
  id: z.string(),
  type: z.literal('teaser'),
  headline: z.string().optional(),
});

export type TeaserData = z.infer<typeof TeaserSchema>;
