import { z } from 'zod';

const QuickEntryElementSchema = z.object({
  title: z.string(),
  link: z.string(),
  link_name: z.string(),
  icon: z.string(),
});

export const QuickEntrySchema = z.object({
  id: z.string(),
  type: z.literal('quick-entry'),
  elements: z.array(QuickEntryElementSchema),
});

export type QuickEntryElementData = z.infer<typeof QuickEntryElementSchema>;
export type QuickEntryData = z.infer<typeof QuickEntrySchema>;
