export const consumeJsonStringCharacter = (
  character: string,
  escaped: boolean,
): { inString: boolean; escaped: boolean } => {
  if (escaped) {
    return { inString: true, escaped: false };
  }
  if (character === '\\') {
    return { inString: true, escaped: true };
  }
  if (character === '"') {
    return { inString: false, escaped: false };
  }
  return { inString: true, escaped: false };
};

export const findMatchingBrace = (text: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      ({ inString, escaped } = consumeJsonStringCharacter(character, escaped));
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      depth += 1;
      continue;
    }
    if (character !== '}') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }

  return -1;
};
