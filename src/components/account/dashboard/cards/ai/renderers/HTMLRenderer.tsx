'use client';

import React from 'react';

interface HTMLRendererProps {
  data: {
    html: string;
  };
}

export const HTMLRenderer: React.FC<HTMLRendererProps> = ({ data }) => {
  const { html } = data;

  if (!html || typeof html !== 'string') {
    return (
      <div className="text-sm text-text-body text-red-500">
        Invalid HTML content
      </div>
    );
  }

  // Basic sanitization - remove potentially dangerous scripts
  // Note: In production, consider using a library like DOMPurify for more robust sanitization
  const sanitizedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: protocol

  return (
    <div
      className="text-sm text-text-body space-y-2
        [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-text-headings [&_h1]:mt-4 [&_h1]:mb-2
        [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text-headings [&_h2]:mt-3 [&_h2]:mb-2
        [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-headings [&_h3]:mt-2 [&_h3]:mb-1
        [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-text-headings [&_h4]:mt-2 [&_h4]:mb-1
        [&_p]:mb-2 [&_p]:text-text-body
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:space-y-1
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:space-y-1
        [&_li]:text-text-body
        [&_strong]:font-semibold [&_strong]:text-text-headings
        [&_em]:italic
        [&_a]:text-text-action [&_a]:hover:text-text-action-hover [&_a]:underline
        [&_code]:bg-surface-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
        [&_blockquote]:border-l-4 [&_blockquote]:border-border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-body"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

