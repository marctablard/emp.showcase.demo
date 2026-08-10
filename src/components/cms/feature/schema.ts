import { z } from 'zod';

export const FeatureSchema = z.object({
  id: z.string(),
  type: z.literal('feature'),
  name: z.string(),
  description: z.string(),
});

export type FeatureData = z.infer<typeof FeatureSchema>;
