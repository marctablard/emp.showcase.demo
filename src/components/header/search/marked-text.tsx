import React from 'react';

export interface MarkedTextProps {
  text: string;
  keyword?: string;
}

export function MarkedText({ text, keyword = '' }: MarkedTextProps) {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const safeKeyword = typeof keyword === 'string' ? keyword : String(keyword ?? '');
  const trimmedKeyword = safeKeyword.trim();
  const source = trimmedKeyword
    ? safeText.replace(new RegExp(trimmedKeyword.split(' ').join('|'), 'gi'), (match) => `<mark>${match}</mark>`)
    : safeText;

  const parts = source
    .split('<mark>')
    .map((texts) => texts.split('</mark>'))
    .flat();

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 0 ? (
          part
        ) : (
          <span className="font-bold" key={index}>
            {part}
          </span>
        ),
      )}
    </>
  );
}

export default MarkedText;
