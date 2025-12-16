import React from 'react';

export interface MarkedTextProps {
  text: string;
  keyword?: string;
}

export function MarkedText({ text, keyword = '<mark>' }: MarkedTextProps) {
  const parts = text
    .replace(new RegExp(keyword.trim().split(' ').join('|'), 'gi'), (match) => `<mark>${match}</mark>`)
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
