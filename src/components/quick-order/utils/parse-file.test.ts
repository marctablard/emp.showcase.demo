import { EmptyFileError, FileTooLargeError, UnsupportedFormatError, parseCSV, parseUploadedFile } from './parse-file';
import type { ParsedEntry } from './parse-text-input';

// ---------- PapaParse mock ----------
const mockPapaParse = jest.fn();
jest.mock('papaparse', () => ({
  __esModule: true,
  default: {
    parse: (...args: unknown[]) => mockPapaParse(...args),
  },
}));

// ---------- SheetJS mock ----------
const mockRead = jest.fn();
const mockSheetToJson = jest.fn();
jest.mock('xlsx', () => ({
  read: (...args: unknown[]) => mockRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
}));

function makeFile(name: string, content: string, size?: number): File {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

describe('parseUploadedFile', () => {
  beforeEach(() => {
    mockPapaParse.mockReset();
    mockRead.mockReset();
    mockSheetToJson.mockReset();
  });

  describe('validation', () => {
    it('throws FileTooLargeError when file exceeds 5MB', async () => {
      const file = makeFile('test.csv', 'data', 6 * 1024 * 1024);
      await expect(parseUploadedFile(file)).rejects.toThrow(FileTooLargeError);
    });

    it('throws EmptyFileError when file has zero bytes', async () => {
      const file = makeFile('test.csv', '', 0);
      await expect(parseUploadedFile(file)).rejects.toThrow(EmptyFileError);
    });

    it('throws UnsupportedFormatError for unsupported extension', async () => {
      const file = makeFile('test.pdf', 'data', 100);
      await expect(parseUploadedFile(file)).rejects.toThrow(UnsupportedFormatError);
    });

    it('throws UnsupportedFormatError for file with no extension', async () => {
      const file = makeFile('noextension', 'data', 100);
      await expect(parseUploadedFile(file)).rejects.toThrow(UnsupportedFormatError);
    });
  });

  describe('CSV parsing via parseCSV', () => {
    it('parses a valid CSV with headers', async () => {
      const file = makeFile('test.csv', 'ProductCode,Quantity\nABC,5\nDEF,3', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['ProductCode', 'Quantity'],
            ['ABC', '5'],
            ['DEF', '3'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'ABC', quantity: 5 },
        { code: 'DEF', quantity: 3 },
      ]);
    });

    it('parses a valid CSV without headers', async () => {
      const file = makeFile('test.csv', 'ABC,5\nDEF,3', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['ABC', '5'],
            ['DEF', '3'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'ABC', quantity: 5 },
        { code: 'DEF', quantity: 3 },
      ]);
    });

    it('parses a semicolon-delimited CSV', async () => {
      const file = makeFile('test.csv', 'SKU;Quantity\nABC;2\nDEF;4', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['SKU', 'Quantity'],
            ['ABC', '2'],
            ['DEF', '4'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'ABC', quantity: 2 },
        { code: 'DEF', quantity: 4 },
      ]);
    });

    it('throws EmptyFileError when CSV has no data rows', async () => {
      const file = makeFile('test.csv', '', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({ data: [] });
      });

      await expect(parseCSV(file)).rejects.toThrow(EmptyFileError);
    });

    it('throws EmptyFileError when CSV has only a header row', async () => {
      const file = makeFile('test.csv', 'ProductCode,Quantity', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [['ProductCode', 'Quantity']],
        });
      });

      await expect(parseCSV(file)).rejects.toThrow(EmptyFileError);
    });

    it('skips empty rows', async () => {
      const file = makeFile('test.csv', 'ABC,5\n\nDEF,3', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['ABC', '5'],
            ['', ''],
            ['DEF', '3'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'ABC', quantity: 5 },
        { code: 'DEF', quantity: 3 },
      ]);
    });

    it('strips CSV injection characters from cell values', async () => {
      const file = makeFile('test.csv', '=CMD,5\n+EXEC,3\n-RUN,2\n@IMPORT,1', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['=CMD', '5'],
            ['+EXEC', '3'],
            ['-RUN', '2'],
            ['@IMPORT', '1'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'CMD', quantity: 5 },
        { code: 'EXEC', quantity: 3 },
        { code: 'RUN', quantity: 2 },
        { code: 'IMPORT', quantity: 1 },
      ]);
    });

    it('skips rows with non-positive quantities instead of coercing them to 1', async () => {
      const file = makeFile('test.csv', 'ABC,-5\nDEF,0\nGHI,2', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['ABC', '-5'],
            ['DEF', '0'],
            ['GHI', '2'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([{ code: 'GHI', quantity: 2 }]);
    });

    it('defaults blank quantity cells to 1', async () => {
      const file = makeFile('test.csv', 'ABC,\nDEF,3', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({
          data: [
            ['ABC', ''],
            ['DEF', '3'],
          ],
        });
      });

      const result = await parseCSV(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'ABC', quantity: 1 },
        { code: 'DEF', quantity: 3 },
      ]);
    });

    it('handles PapaParse error callback', async () => {
      const file = makeFile('test.csv', 'bad', 100);

      mockPapaParse.mockImplementation((_file: File, options: { error: (err: Error) => void }) => {
        options.error(new Error('Parse failed'));
      });

      await expect(parseCSV(file)).rejects.toThrow('Parse failed');
    });
  });

  describe('XLSX parsing', () => {
    it('delegates to parseXLSX for .xlsx files', async () => {
      const file = makeFile('test.xlsx', 'dummy', 100);

      mockRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      mockSheetToJson.mockReturnValue([
        ['ABC', '5'],
        ['DEF', '3'],
      ]);

      const result = await parseUploadedFile(file);
      expect(result).toEqual<ParsedEntry[]>([
        { code: 'ABC', quantity: 5 },
        { code: 'DEF', quantity: 3 },
      ]);
    });

    it('detects header row in XLSX', async () => {
      const file = makeFile('test.xlsx', 'dummy', 100);

      mockRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      mockSheetToJson.mockReturnValue([
        ['Item_Number', 'Quantity'],
        ['ABC', '2'],
      ]);

      const result = await parseUploadedFile(file);
      expect(result).toEqual<ParsedEntry[]>([{ code: 'ABC', quantity: 2 }]);
    });

    it('throws EmptyFileError when XLSX has no sheets', async () => {
      const file = makeFile('test.xlsx', 'dummy', 100);

      mockRead.mockReturnValue({
        SheetNames: [],
        Sheets: {},
      });

      await expect(parseUploadedFile(file)).rejects.toThrow(EmptyFileError);
    });

    it('throws EmptyFileError when XLSX sheet has no data rows', async () => {
      const file = makeFile('test.xlsx', 'dummy', 100);

      mockRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      mockSheetToJson.mockReturnValue([]);

      await expect(parseUploadedFile(file)).rejects.toThrow(EmptyFileError);
    });
  });

  describe('routing to correct parser', () => {
    it('routes .csv files to CSV parser', async () => {
      const file = makeFile('data.csv', 'ABC,5', 100);

      mockPapaParse.mockImplementation((_file: File, options: { complete: (r: { data: string[][] }) => void }) => {
        options.complete({ data: [['ABC', '5']] });
      });

      const result = await parseUploadedFile(file);
      expect(result).toEqual<ParsedEntry[]>([{ code: 'ABC', quantity: 5 }]);
      expect(mockPapaParse).toHaveBeenCalled();
    });

    it('routes .xlsx files to XLSX parser', async () => {
      const file = makeFile('data.xlsx', 'dummy', 100);

      mockRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      mockSheetToJson.mockReturnValue([['XYZ', '10']]);

      const result = await parseUploadedFile(file);
      expect(result).toEqual<ParsedEntry[]>([{ code: 'XYZ', quantity: 10 }]);
      expect(mockRead).toHaveBeenCalled();
    });
  });
});
