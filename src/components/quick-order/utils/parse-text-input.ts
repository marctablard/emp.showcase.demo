export interface ParsedEntry {
  code: string;
  quantity: number;
}

export interface ParseResult {
  entries: ParsedEntry[];
  errors: string[];
}

/**
 * Parses multi-line text input into an array of product code + quantity entries.
 *
 * Each line is split by comma, semicolon, or whitespace.
 * First token = product code, second token (optional) = quantity (defaults to 1).
 * Empty lines and whitespace-only lines are ignored.
 *
 * If the second token is present but is not a positive integer, the line is
 * reported in `errors` and excluded from `entries`.
 */
export function parseTextInput(text: string): ParseResult {
  if (!text || !text.trim()) {
    return { entries: [], errors: [] };
  }

  const lines = text.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Split by comma, semicolon, or whitespace
    const tokens = trimmed.split(/[,;\s]+/).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }

    const code = tokens[0].trim();
    if (!code) {
      continue;
    }

    let quantity = 1;
    if (tokens.length >= 2) {
      const raw = tokens[1];
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        errors.push(trimmed);
        continue;
      }
      quantity = parsed;
    }

    entries.push({ code, quantity });
  }

  return { entries, errors };
}
