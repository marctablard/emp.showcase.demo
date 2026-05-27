import { BlockTypes, type ISbStoryData, MarkTypes, type StoryblokRichTextNode, TextTypes } from '@storyblok/react/rsc';
import 'server-only';
import type { RichtextBlock, RichtextData, RichtextInline } from '@/components/cms/richtext/schema';
import { injectable } from '@/platform/core/di/injectable';
import type { CMSComponent, CMSPage } from '@/platform/services/model/cms';

type RichtextTextInline = Extract<RichtextInline, { kind: 'text' }>;

const HEADING_LEVELS = new Set([1, 2, 3, 4, 5, 6]);

/**
 * Translates Storyblok-native wire formats into the agnostic CMS shapes the
 * renderer consumes:
 *
 *  - `mapRichtext` lifts a TipTap document into the agnostic `RichtextData`
 *    AST so a Storyblok-sourced body renders through the same `<Richtext>`
 *    path as a local-JSON one. Nodes the agnostic schema cannot represent
 *    (TipTap `blockquote` / `image` / `code_block`, and the `highlight` /
 *    `superscript` / `subscript` marks) are dropped rather than faked.
 *  - `mapPage` lifts a story payload into a `CMSPage`, turning each
 *    `content.body[]` blok into a `CMSComponent` (`component` → `type`,
 *    `_uid` → `id`) and pre-mapping richtext-typed fields to the AST.
 */
@injectable('StoryblokCmsMapper', 'Singleton')
export class StoryblokCmsMapper {
  mapRichtext(node: StoryblokRichTextNode | null | undefined, id: string): RichtextData | undefined {
    if (!node) {
      return undefined;
    }
    const children = this.childrenOf(node);
    const blocks = children.flatMap((child) => this.mapBlock(child));
    if (blocks.length === 0) {
      return undefined;
    }
    return { id, type: 'richtext', blocks };
  }

  mapPage(story: ISbStoryData): CMSPage {
    const content = (story?.content ?? {}) as Record<string, unknown>;
    const body = Array.isArray(content.body) ? (content.body as Array<Record<string, unknown>>) : [];

    return {
      title: typeof content.title === 'string' ? content.title : (story?.name ?? ''),
      description: typeof content.description === 'string' ? content.description : '',
      url: story?.full_slug ?? story?.slug ?? '',
      no_margin: content.no_margin === true ? true : undefined,
      components: body.map((blok) => this.mapComponent(blok)),
    };
  }

  private mapComponent(blok: Record<string, unknown>): CMSComponent {
    const { _uid, component, ...rest } = blok;
    const id = typeof _uid === 'string' ? _uid : '';
    const type = typeof component === 'string' ? component : '';

    const mapped: Record<string, unknown> = { ...rest, id, type };

    if (type === 'article' && rest.content) {
      mapped.content = this.mapRichtext(rest.content as StoryblokRichTextNode, id);
    }

    return mapped as unknown as CMSComponent;
  }

  private childrenOf(node: StoryblokRichTextNode): StoryblokRichTextNode[] {
    return Array.isArray(node.content) ? (node.content as StoryblokRichTextNode[]) : [];
  }

  private mapBlock(node: StoryblokRichTextNode): RichtextBlock[] {
    switch (node.type) {
      case BlockTypes.PARAGRAPH:
        return [{ kind: 'paragraph', inlines: this.mapInlines(this.childrenOf(node)) }];
      case BlockTypes.HEADING:
        return [
          {
            kind: 'heading',
            level: this.headingLevel(node),
            inlines: this.mapInlines(this.childrenOf(node)),
          },
        ];
      case BlockTypes.UL_LIST:
        return [{ kind: 'list', ordered: false, items: this.mapListItems(node) }];
      case BlockTypes.OL_LIST:
        return [{ kind: 'list', ordered: true, items: this.mapListItems(node) }];
      case BlockTypes.HR:
        return [{ kind: 'hr' }];
      default:
        return [];
    }
  }

  private headingLevel(node: StoryblokRichTextNode): 1 | 2 | 3 | 4 | 5 | 6 {
    const level = (node.attrs as { level?: number } | undefined)?.level;
    return level !== undefined && HEADING_LEVELS.has(level) ? (level as 1 | 2 | 3 | 4 | 5 | 6) : 1;
  }

  private mapListItems(node: StoryblokRichTextNode): RichtextInline[][] {
    return this.childrenOf(node).map((item) => {
      const inlineSources = this.childrenOf(item).flatMap((child) =>
        child.type === BlockTypes.PARAGRAPH ? this.childrenOf(child) : [child],
      );
      return this.mapInlines(inlineSources);
    });
  }

  private mapInlines(nodes: StoryblokRichTextNode[]): RichtextInline[] {
    return nodes.flatMap((node) => this.mapInline(node));
  }

  private mapInline(node: StoryblokRichTextNode): RichtextInline[] {
    if (node.type === BlockTypes.BR) {
      return [{ kind: 'br' }];
    }
    if (node.type !== TextTypes.TEXT) {
      return [];
    }

    const value = typeof node.text === 'string' ? node.text : '';
    const marks = (node.marks ?? []) as Array<{ type: string; attrs?: Record<string, unknown> }>;

    const link = marks.find((mark) => mark.type === MarkTypes.LINK);
    if (link) {
      const href = typeof link.attrs?.href === 'string' ? link.attrs.href : '';
      return [{ kind: 'link', href, text: value }];
    }

    const inline: RichtextTextInline = { kind: 'text', value };
    for (const mark of marks) {
      switch (mark.type) {
        case MarkTypes.BOLD:
        case MarkTypes.STRONG:
          inline.bold = true;
          break;
        case MarkTypes.ITALIC:
          inline.italic = true;
          break;
        case MarkTypes.CODE:
          inline.code = true;
          break;
        case MarkTypes.UNDERLINE:
          inline.underline = true;
          break;
        case MarkTypes.STRIKE:
          inline.strike = true;
          break;
        default:
          break;
      }
    }
    return [inline];
  }
}

export default StoryblokCmsMapper;
