import { z } from 'zod';

export const ButtonSchema = z.object({
  id: z.string(),
  type: z.literal('button'),
  title: z.string(),
  link: z.string(),
  iconLeft: z.string().optional(),
  iconRight: z.string().optional(),
});

export type ButtonData = z.infer<typeof ButtonSchema>;
