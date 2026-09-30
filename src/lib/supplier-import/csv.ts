// CSV as suppliers send it: UTF-8 or Windows-1252, « ; » or « , » or tabs,
// quoted cells with separators and line breaks. Pure module.
import { tableFromRecords, type ExtractedTable } from './table';

export type CsvResult = ExtractedTable & {
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
  delimiter: string;
};

/** Bytes to text, without guessing wrong on accented characters. */
export function decodeText(bytes: Uint8Array): {
  text: string;
  encoding: CsvResult['encoding'];
} {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'utf-8',
    };
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return {
      text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
      encoding: 'utf-16le',
    };
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return {
      text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
      encoding: 'utf-16be',
    };
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      encoding: 'utf-8',
    };
  } catch {
    // Excel on Windows saves CSV in Windows-1252 (« é » is a single byte).
    return {
      text: new TextDecoder('windows-1252').decode(bytes),
      encoding: 'windows-1252',
    };
  }
}

const DELIMITERS = [';', ',', '\t', '|'];

/** The separator that splits the first lines the most regularly. */
export function detectDelimiter(text: string) {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim())
    .slice(0, 30);
  let best = ',';
  let bestScore = -1;
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => {
      let inside = false;
      let count = 0;
      for (const char of line) {
        if (char === '"') inside = !inside;
        else if (char === delimiter && !inside) count++;
      }
      return count;
    });
    const frequency = new Map<number, number>();
    for (const count of counts)
      if (count > 0) frequency.set(count, (frequency.get(count) ?? 0) + 1);
    const [mode = 0, occurrences = 0] =
      [...frequency].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [];
    // Lines split the same way, as many columns as possible.
    const score = occurrences * 100 + mode;
    if (mode > 0 && score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

/** RFC 4180 records: doubled quotes, separators and line breaks in quotes. */
export function parseCsvRecords(text: string, delimiter: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && !cell.trim()) {
      quoted = true;
      cell = '';
    } else if (char === delimiter) {
      record.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else cell += char;
  }
  if (cell || record.length) {
    record.push(cell);
    records.push(record);
  }
  return records;
}

export function parseCsv(bytes: Uint8Array): CsvResult {
  const { text, encoding } = decodeText(bytes);
  const delimiter = detectDelimiter(text);
  return {
    ...tableFromRecords(parseCsvRecords(text, delimiter)),
    encoding,
    delimiter,
  };
}
