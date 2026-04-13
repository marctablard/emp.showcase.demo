import React from 'react';

export interface MarkedTextProps {
  text: string;
  keyword?: string;
}

export function MarkedText({ text, keyword = '<mark>' }: MarkedTextProps) {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const safeKeyword = typeof keyword === 'string' ? keyword : String(keyword ?? '');
  const parts = safeText
    .replace(new RegExp(safeKeyword.trim().split(' ').join('|'), 'gi'), (match) => `<mark>${match}</mark>`)
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
