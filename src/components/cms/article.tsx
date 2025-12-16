'use client';

import { StoryblokRichTextNode, storyblokEditable } from '@storyblok/react/rsc';
import { H1, H2, H3 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import RichText from './richtext';

/**
 * Article component for Storyblok
 * Displays an article with title, introduction, video, rich text, and linked products
 */
interface ArticleProps {
  blok: {
    title?: string;
    introduction?: string;
    video?: {
      url?: string;
      title?: string;
    };
    content?: StoryblokRichTextNode; // Rich text content
    linked_products?: Array<{
      _uid: string;
      product_id?: string;
      name?: string;
    }>;
  };
}

const Article = ({ blok }: ArticleProps) => {
  return (
    <article {...storyblokEditable(blok)} className="article max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6">
      {/* Article header */}
      {blok.title ||
        (blok.introduction && (
          <header className="mb-8">
            {blok.title && (
              <H1 variant="h5" className="mb-4">
                {blok.title}
              </H1>
            )}

            {blok.introduction && <div className="text-lg text-text-on-disabled mb-6">{blok.introduction}</div>}
          </header>
        ))}

      {/* Video */}
      {blok.video?.url && (
        <div className="mb-8">
          <iframe
            src={blok.video.url}
            title={blok.video.title || 'Video'}
            className="w-full aspect-video rounded-md"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Rich text content */}
      {blok.content && <RichText content={blok.content} className="mb-8" />}

      {/* Linked products */}
      {blok.linked_products && blok.linked_products.length > 0 && (
        <div className="mt-12">
          <H2 variant="h6" className="mb-4">
            Related Products
          </H2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {blok.linked_products.map((product) => (
              <div key={product._uid} className="border rounded-md p-4">
                <H3 variant="h6" className="mb-2">
                  {product.name}
                </H3>
                {product.product_id && (
                  <Link href={`/product/${product.product_id}`} className="text-text-action hover:underline">
                    View Product
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default Article;
