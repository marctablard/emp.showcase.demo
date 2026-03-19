'use client';

import { BlockTypes, StoryblokRichTextNode, TextTypes } from '@storyblok/react/rsc';
import { H1, H2, H3, H4, H5, H6 } from '../ui/h';

interface RichTextProps {
  content: StoryblokRichTextNode;
  className?: string;
}

function RichTextHeading(node: StoryblokRichTextNode): React.ReactNode {
  const content = node.content.map((item, itemIndex) => <RichTextNode key={itemIndex} {...item} />);
  switch (node.attrs?.level) {
    default:
    case 1:
      return (
        <H1 className="mb-4" {...node.attrs}>
          {content}
        </H1>
      );
    case 2:
      return (
        <H2 className="mb-4" {...node.attrs}>
          {content}
        </H2>
      );
    case 3:
      return (
        <H3 className="mb-4" {...node.attrs}>
          {content}
        </H3>
      );
    case 4:
      return (
        <H4 className="mb-4" {...node.attrs}>
          {content}
        </H4>
      );
    case 5:
      return (
        <H5 className="mb-4" {...node.attrs}>
          {content}
        </H5>
      );
    case 6:
      return (
        <H6 className="mb-4" {...node.attrs}>
          {content}
        </H6>
      );
  }
}

function RichTextNode(node: StoryblokRichTextNode): React.ReactNode {
  switch (node.type) {
    case BlockTypes.HEADING:
      return <RichTextHeading {...node} />;
    case BlockTypes.PARAGRAPH:
      return (
        <p className="mb-4">
          {node.content?.map((item, itemIndex) => (
            <RichTextNode key={itemIndex} {...item} />
          ))}
        </p>
      );
    case BlockTypes.DOCUMENT:
      return (
        <>
          {node.content?.map((item, itemIndex) => (
            <RichTextNode key={itemIndex} {...item} />
          ))}
        </>
      );
    case BlockTypes.HR:
      return <hr className="mb-4" />;
    case BlockTypes.OL_LIST:
      return (
        <ol className="mb-4 list-decimal">
          {node.content?.map((item, itemIndex) => (
            <RichTextNode key={itemIndex} {...item} />
          ))}
        </ol>
      );
    case BlockTypes.UL_LIST:
      return (
        <ul className="mb-4 list-disc">
          {node.content?.map((item, itemIndex) => (
            <RichTextNode key={itemIndex} {...item} />
          ))}
        </ul>
      );
    case BlockTypes.LIST_ITEM:
      return (
        <li className="mb-2 ml-4">
          {node.content?.map((item, itemIndex) => (
            <RichTextNode key={itemIndex} {...item} />
          ))}
        </li>
      );
    case BlockTypes.BR:
      return <br />;
    default:
    case TextTypes.TEXT:
      return <>{node.text || ''}</>;
  }
}

/**
 * RichText component for rendering Storyblok rich text content
 * Maps Storyblok rich text nodes to shadcn components
 */
export default function RichText({ content, className }: RichTextProps) {
  if (!content) {
    return null;
  }
  return (
    <div className={className}>
      <RichTextNode {...content} />
    </div>
  );
}
