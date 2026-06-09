import Papa from 'papaparse';
import type { ParsedEntry } from './parse-text-input';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const HEADER_PATTERNS = [
  'productcode',
  'product_code',
  'sku',
  'code',
  'item',
  'itemnumber',
  'item_number',
  'artikelnummer',
];

export class UnsupportedFormatError extends Error {
  constructor(extension: string) {
    super(`Unsupported file format: ${extension}`);
    this.name = 'UnsupportedFormatError';
  }
}

export class EmptyFileError extends Error {
  constructor() {
    super('The uploaded file is empty.');
    this.name = 'EmptyFileError';
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super(`File exceeds the maximum allowed size of 5MB.`);
    this.name = 'FileTooLargeError';
  }
}

/**
 * Strips leading characters that could trigger CSV injection in spreadsheet applications.
 * Characters `=`, `+`, `-`, `@` at the start of a cell can be interpreted as formulas.
 */
function sanitizeCellValue(value: string): string {
  return value.replace(/^[=+\-@]+/, '').trim();
}

/**
 * Removes BOM (Byte Order Mark) from the beginning of a string.
 */
function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

/**
 * Determines whether the first row is a header row by checking if the first cell
 * matches any known header pattern.
 */
function isHeaderRow(firstCell: string): boolean {
  const normalized = firstCell.toLowerCase().replace(/[\s_-]/g, '');
  return HEADER_PATTERNS.includes(normalized);
}

/**
 * Extracts a ParsedEntry from a row of strings (two-column: code, quantity).
 * Returns null for empty or invalid rows.
 */
function rowToEntry(row: string[]): ParsedEntry | null {
  const rawCode = (row[0] ?? '').trim();
  if (!rawCode) {
    return null;
  }

  const code = sanitizeCellValue(rawCode);
  if (!code) {
    return null;
  }

  let quantity = 1;
  if (row.length >= 2) {
    const rawQty = (row[1] ?? '').trim();
    if (!rawQty) {
      return { code, quantity };
    }

    const parsed = parseInt(rawQty, 10);
    if (isNaN(parsed) || parsed < 1) {
      return null;
    }

    quantity = parsed;
  }

  return { code, quantity };
}

/**
 * Parses a CSV file into an array of ParsedEntry using PapaParse.
 * Supports both comma-separated and semicolon-separated formats.
 */
export function parseCSV(file: File): Promise<ParsedEntry[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete(results) {
        try {
          const rows = results.data;
          if (!rows || rows.length === 0) {
            reject(new EmptyFileError());
            return;
          }

          let startIndex = 0;
          const firstCell = (rows[0]?.[0] ?? '').trim();
          const cleaned = stripBom(firstCell);
          if (isHeaderRow(cleaned)) {
            startIndex = 1;
          }

          const entries: ParsedEntry[] = [];
          for (let i = startIndex; i < rows.length; i++) {
            const entry = rowToEntry(rows[i]);
            if (entry) {
              entries.push(entry);
            }
          }

          if (entries.length === 0) {
            reject(new EmptyFileError());
            return;
          }

          resolve(entries);
        } catch (err) {
          reject(err);
        }
      },
      error(err: Error) {
        reject(err);
      },
    });
  });
}

/**
 * Parses an XLSX file into an array of ParsedEntry using SheetJS.
 */
export async function parseXLSX(file: File): Promise<ParsedEntry[]> {
  const { read, utils } = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new EmptyFileError();
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rows || rows.length === 0) {
    throw new EmptyFileError();
  }

  let startIndex = 0;
  const firstCell = String(rows[0]?.[0] ?? '').trim();
  const cleaned = stripBom(firstCell);
  if (isHeaderRow(cleaned)) {
    startIndex = 1;
  }

  const entries: ParsedEntry[] = [];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i].map((cell) => String(cell));
    const entry = rowToEntry(row);
    if (entry) {
      entries.push(entry);
    }
  }

  if (entries.length === 0) {
    throw new EmptyFileError();
  }

  return entries;
}

/**
 * Dispatches file parsing to the appropriate parser based on file extension.
 * Validates file size before parsing.
 */
export async function parseUploadedFile(file: File): Promise<ParsedEntry[]> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError();
  }

  if (file.size === 0) {
    throw new EmptyFileError();
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return parseCSV(file);
    case 'xlsx':
      return parseXLSX(file);
    default:
      throw new UnsupportedFormatError(extension ?? 'unknown');
  }
}
