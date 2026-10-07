import { extractEnvelopeMessageField, sanitizeCompletedShopperText } from '@/lib/common/ai-stream-preview';
import { getLogger } from '@/lib/logger/use-logger-client';

export const UNRECOGNIZED_RESPONSE_TYPE = 'unrecognized';
export const UNRECOGNIZED_JSON_PREVIEW_LINES = 5;
export const UNRECOGNIZED_JSON_PREVIEW_CHARS = 240;

export type UnrecognizedResponseData = {
  previewJson: string;
};

export function looksLikeStructuredCaption(value: string): boolean {
  const trimmed = value.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```');
}

export function firstJsonPreviewLines(value: unknown, maxLines = UNRECOGNIZED_JSON_PREVIEW_LINES): string {
  const text = stringifyForPreview(value);
  const clipped = text.split('\n').slice(0, maxLines).join('\n');
  if (clipped.length <= UNRECOGNIZED_JSON_PREVIEW_CHARS) {
    return clipped;
  }
  return `${clipped.slice(0, UNRECOGNIZED_JSON_PREVIEW_CHARS)}…`;
}

export function shopperCaptionFromRaw(rawMessage: string): string {
  try {
    const parsed: unknown = JSON.parse(rawMessage);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.message === 'string') {
        return sanitizeCompletedShopperText(record.message);
      }
      if (record.message && typeof record.message === 'object' && !Array.isArray(record.message)) {
        const nested = (record.message as { message?: unknown }).message;
        if (typeof nested === 'string') {
          return sanitizeCompletedShopperText(nested);
        }
      }
    }
  } catch {
    // Incomplete JSON — fall through to the field scanner.
  }
  return sanitizeCompletedShopperText(extractEnvelopeMessageField(rawMessage));
}

export function resolveUnrecognizedLogSource(rawMessage: string, data: unknown): unknown {
  if (data != null && !isEmptyRecord(data)) {
    try {
      return { data, envelope: JSON.parse(rawMessage) };
    } catch {
      return { data, rawMessage };
    }
  }
  try {
    return JSON.parse(rawMessage);
  } catch {
    return { rawMessage };
  }
}

export function logUnrecognizedAiResponse(source: unknown): void {
  getLogger().warn({ aiResponse: source }, 'AI Helper received an unrecognized response');
  // eslint-disable-next-line no-console -- shopper-facing diagnostic; the fallback UI tells them to open the browser console
  console.info('[AI Helper] Unrecognized response', source);
}

export function buildUnrecognizedResponseData(rawMessage: string, data: unknown): UnrecognizedResponseData {
  const previewSource = data != null && !isEmptyRecord(data) ? data : tryParseOrRaw(rawMessage);
  return {
    previewJson: firstJsonPreviewLines(previewSource),
  };
}

function stringifyForPreview(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
}

function tryParseOrRaw(rawMessage: string): unknown {
  try {
    return JSON.parse(rawMessage);
  } catch {
    return rawMessage;
  }
}

function isEmptyRecord(value: unknown): boolean {
  return (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0
  );
}
