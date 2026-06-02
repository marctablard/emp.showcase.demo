import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { sanitizeHref } from '@/lib/sanitize-href';
import { cn } from '@/lib/utils';
import type { RichtextBlock, RichtextData, RichtextInline } from './schema';

export type RichtextProps = RichtextData & HTMLAttributes<HTMLDivElement>;

const HEADING_TAGS = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

const renderInline = (inline: RichtextInline, key: number): ReactNode => {
  if (inline.kind === 'link') {
    return (
      <a key={key} href={sanitizeHref(inline.href)}>
        {inline.text}
      </a>
    );
  }
  if (inline.kind === 'br') {
    return <br key={key} />;
  }
  let node: ReactNode = inline.value;
  if (inline.code) {
    node = <code>{node}</code>;
  }
  if (inline.strike) {
    node = <s>{node}</s>;
  }
  if (inline.underline) {
    node = <u>{node}</u>;
  }
  if (inline.italic) {
    node = <em>{node}</em>;
  }
  if (inline.bold) {
    node = <strong>{node}</strong>;
  }
  return <span key={key}>{node}</span>;
};

const renderInlines = (inlines: readonly RichtextInline[]): ReactNode =>
  inlines.map((inline, idx) => renderInline(inline, idx));

const renderBlock = (block: RichtextBlock, key: number): ReactNode => {
  switch (block.kind) {
    case 'heading': {
      const Tag = HEADING_TAGS[block.level] as keyof JSX.IntrinsicElements;
      return <Tag key={key}>{renderInlines(block.inlines)}</Tag>;
    }
    case 'paragraph':
      return <p key={key}>{renderInlines(block.inlines)}</p>;
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag key={key}>
          {block.items.map((item, itemIdx) => (
            <li key={itemIdx}>{renderInlines(item)}</li>
          ))}
        </ListTag>
      );
    }
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element -- agnostic AST renders the wire-format img tag as-is; provider-aware optimisation happens at the adapter layer.
      return <img key={key} src={block.src} alt={block.alt ?? ''} />;
    case 'quote':
      return <blockquote key={key}>{renderInlines(block.inlines)}</blockquote>;
    case 'code':
      return (
        <pre key={key}>
          <code>{block.value}</code>
        </pre>
      );
    case 'hr':
      return <hr key={key} className="mb-4" />;
  }
};

const Richtext = ({ id: _id, type: _type, blocks, className, ...rest }: RichtextProps) => {
  return (
    <div className={cn('richtext', className)} {...rest}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
};

export default Richtext;
