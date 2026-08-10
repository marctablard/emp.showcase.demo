import { z } from 'zod';

const InlineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    value: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    code: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('link'),
    href: z.string(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal('br'),
  }),
]);

export type RichtextInline = z.infer<typeof InlineSchema>;

const BlockSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
    inlines: z.array(InlineSchema),
  }),
  z.object({
    kind: z.literal('paragraph'),
    inlines: z.array(InlineSchema),
  }),
  z.object({
    kind: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(z.array(InlineSchema)),
  }),
  z.object({
    kind: z.literal('image'),
    src: z.string(),
    alt: z.string().optional(),
  }),
  z.object({
    kind: z.literal('quote'),
    inlines: z.array(InlineSchema),
  }),
  z.object({
    kind: z.literal('code'),
    language: z.string().optional(),
    value: z.string(),
  }),
  z.object({
    kind: z.literal('hr'),
  }),
]);

export type RichtextBlock = z.infer<typeof BlockSchema>;

export const RichtextSchema = z.object({
  id: z.string(),
  type: z.literal('richtext'),
  blocks: z.array(BlockSchema),
});

export type RichtextData = z.infer<typeof RichtextSchema>;
