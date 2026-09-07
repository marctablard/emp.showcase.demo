const QUOTED_MESSAGE_FIELD = /"message"\s*:\s*"((?:\\.|[^"\\])*)"/;

function tryParseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function extractJsonObject(raw: string): Record<string, unknown> | undefined {
  const parsed = tryParseJsonObject(raw.trim());
  if (parsed) {
    return parsed;
  }

  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    return undefined;
  }

  return tryParseJsonObject(raw.slice(jsonStart));
}

function extractQuotedMessageField(raw: string): string | undefined {
  const match = QUOTED_MESSAGE_FIELD.exec(raw);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(`"${match[1]}"`);
    return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : undefined;
  } catch {
    return match[1].trim() || undefined;
  }
}

/** Pulls Emporix `message` or `fault.faultstring` out of a JSON body or a wrapped Error string. */
export function extractUpstreamMessage(raw: string): string | undefined {
  const parsed = extractJsonObject(raw);
  if (parsed) {
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }

    const fault = parsed.fault;
    if (fault && typeof fault === 'object' && !Array.isArray(fault)) {
      const faultstring = (fault as Record<string, unknown>).faultstring;
      if (typeof faultstring === 'string' && faultstring.trim()) {
        return faultstring.trim();
      }
    }
  }

  return extractQuotedMessageField(raw);
}
