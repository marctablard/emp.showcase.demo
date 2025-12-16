'use client';

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { HTMLData } from '../types';

interface HTMLRendererProps {
  data: HTMLData;
}

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'mark',
    'small',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'a',
    'code',
    'pre',
    'blockquote',
    'div',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class', 'id'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
};

export const HTMLRenderer: React.FC<HTMLRendererProps> = ({ data }) => {
  const { html } = data;

  const { sanitizedHtml, error } = useMemo(() => {
    try {
      const clean = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
      return { sanitizedHtml: clean, error: null };
    } catch (err) {
      console.error('[HTMLRenderer] Sanitization error:', err);
      return { sanitizedHtml: null, error: 'Failed to sanitize HTML content' };
    }
  }, [html]);

  if (error || !sanitizedHtml) {
    return (
      <div className="text-sm text-red-500 p-3 bg-red-50 rounded border border-red-200" role="alert">
        <strong className="font-semibold">Error: </strong>
        {error}
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
};
