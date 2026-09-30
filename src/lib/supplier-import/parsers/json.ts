// JSON exports: an array of products, or an object holding one
// ({ "products": [...] }). Nested objects become « parent.child » columns.
// Pure module.
import { decodeText } from '../csv';
import {
  ImportFileError,
  uniqueHeaders,
  type ExtractedTable,
  type TableRow,
} from '../table';

export type JsonResult = ExtractedTable & { path: string | null };

type Found = { path: string | null; items: unknown[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The largest array of objects, at most three levels down. */
function findRecords(
  value: unknown,
  path: string | null,
  depth: number,
): Found | null {
  if (Array.isArray(value))
    return value.some(isRecord) ? { path, items: value } : null;
  if (!isRecord(value) || depth > 3) return null;
  let best: Found | null = null;
  for (const [key, child] of Object.entries(value)) {
    const found = findRecords(child, path ? `${path}.${key}` : key, depth + 1);
    if (found && (!best || found.items.length > best.items.length))
      best = found;
  }
  return best;
}

function flatten(
  value: unknown,
  prefix: string,
  into: Map<string, string>,
  depth = 0,
) {
  if (isRecord(value) && depth < 2) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, into, depth + 1);
    return;
  }
  let text = '';
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' && Number.isFinite(value))
    text = Number.isInteger(value)
      ? value.toLocaleString('en-US', { useGrouping: false })
      : String(value);
  else if (typeof value === 'boolean') text = value ? 'oui' : 'non';
  else if (Array.isArray(value))
    text = value
      .filter((item) => ['string', 'number'].includes(typeof item))
      .join(', ');
  into.set(prefix || 'valeur', text);
}

export function parseJson(bytes: Uint8Array, maxRows: number): JsonResult {
  let data: unknown;
  try {
    data = JSON.parse(decodeText(bytes).text);
  } catch {
    throw new ImportFileError('Fichier JSON illisible (syntaxe invalide).');
  }
  const found = findRecords(data, null, 0);
  if (!found)
    throw new ImportFileError('Aucune liste de produits trouvée dans ce JSON.');
  const columns: string[] = [];
  const known = new Set<string>();
  const flat = found.items.slice(0, maxRows + 1).map((item) => {
    const cells = new Map<string, string>();
    if (isRecord(item)) flatten(item, '', cells);
    for (const key of cells.keys())
      if (!known.has(key) && columns.length < 150) {
        known.add(key);
        columns.push(key);
      }
    return cells;
  });
  const rows: TableRow[] = [];
  let skipped = 0;
  flat.forEach((cells, index) => {
    const values = columns.map((column) => cells.get(column) ?? '');
    if (!values.some((value) => value.trim())) {
      skipped++;
      return;
    }
    rows.push({ number: index + 1, source: null, cells: values });
  });
  return { headers: uniqueHeaders(columns), rows, skipped, path: found.path };
}
