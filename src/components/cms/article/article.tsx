import type { HTMLAttributes } from 'react';
import { H1, H2, H3 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import Richtext from '../richtext/richtext';
import ArticleProductLink from './article-product-link';
import type { ArticleData } from './schema';

/**
 * The content schema field carries the agnostic richtext AST;
 * HTMLAttributes has its own legacy content string attribute that
 * conflicts at the type level. Omitting it on the HTML side preserves
 * the schema field and keeps spread-through via data-* / aria-* /
 * className intact, and prevents the AST object from leaking onto the
 * DOM as a stringified content="[object Object]" attribute.
 */
export type ArticleProps = ArticleData & Omit<HTMLAttributes<HTMLElement>, 'content'>;

/**
 * Server component: renders the article shell — title / introduction
 * header, optional iframe video, the agnostic <Richtext> body, and the
 * linked-products grid. The per-card "View Product" link is delegated to
 * the article-product-link client island because Link from
 * @/i18n/navigation is client-only.
 *
 * Behaviour preserved verbatim from the previous flat implementation,
 * including its title || (introduction && (...)) header expression: when
 * title is present, it short-circuits to the raw title string (no H1, no
 * header wrapper); when title is absent and introduction is present, the
 * full header block renders. The conditional shape is load-bearing for
 * existing pages.
 *
 * The header renders whenever a title OR an introduction is present: the
 * title (when set) is wrapped in an <H1>, the introduction in its styled
 * block. Both are optional and rendered independently inside the shared
 * <header>.
 *
 * The body uses the agnostic <Richtext> — adapters that speak a
 * different wire format pre-map their richtext into the semantic AST at
 * the adapter boundary.
 */
const Article = ({
  id: _id,
  type: _type,
  title,
  introduction,
  video,
  content,
  linked_products,
  className,
  ...rest
}: Readonly<ArticleProps>) => {
  return (
    <article className={cn('article max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6', className)} {...rest}>
      {(title || introduction) && (
        <header className="mb-8">
          {title && (
            <H1 variant="h5" className="mb-4">
              {title}
            </H1>
          )}

          {introduction && <div className="text-lg text-text-on-disabled mb-6">{introduction}</div>}
        </header>
      )}

      {video?.url && (
        <div className="mb-8">
          <iframe
            src={video.url}
            title={video.title || 'Video'}
            className="w-full aspect-video rounded-md"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {content && <Richtext {...content} className="mb-8" />}

      {linked_products && linked_products.length > 0 && (
        <div className="mt-12">
          <H2 variant="h6" className="mb-4">
            Related Products
          </H2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {linked_products.map((product) => (
              <div key={product._uid} className="border rounded-md p-4">
                <H3 variant="h6" className="mb-2">
                  {product.name}
                </H3>
                <ArticleProductLink productId={product.product_id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default Article;
