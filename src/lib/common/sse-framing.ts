export const removeOptionalSpace = (value: string): string => {
  return value.startsWith(' ') ? value.slice(1) : value;
};

export const takeCompleteSseBlocks = (buffer: string): { blocks: string[]; rest: string } => {
  const normalized = buffer.replaceAll('\r\n', '\n');
  const separator = '\n\n';
  const lastSeparator = normalized.lastIndexOf(separator);
  if (lastSeparator === -1) {
    return { blocks: [], rest: normalized };
  }

  const complete = normalized.slice(0, lastSeparator);
  const rest = normalized.slice(lastSeparator + separator.length);
  return {
    blocks: complete.split(separator).filter((block) => block !== ''),
    rest,
  };
};
