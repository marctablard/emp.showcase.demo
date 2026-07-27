export function HighlightedText({ text }: { text: string }) {
  if (!text.includes('<mark>')) {
    return <>{text}</>;
  }
  const parts = text.split(/<mark>|<\/mark>/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : (
          <span key={i} className="font-bold text-text-action">
            {part}
          </span>
        ),
      )}
    </>
  );
}
