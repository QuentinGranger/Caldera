// Suggested correspondence « supplier column → Caldera field », from the
// column names and what the values look like. Always shown to the
// administrator, who corrects it before anything is analysed. Pure module.
import {
  FIELDS,
  normalizeHeader,
  sameCompactHeader,
  type FieldKey,
} from './fields';
import {
  inferDateOrder,
  inferDecimal,
  normalizeEan,
  type DateOrder,
  type Mapping,
} from './normalize';

export type Suggestion = {
  mapping: Mapping;
  /** 0 to 1 per mapped field. */
  confidence: Partial<Record<FieldKey, number>>;
};

function nameScore(header: string, synonyms: readonly string[]) {
  const value = normalizeHeader(header);
  if (!value) return 0;
  if (synonyms.includes(value)) return 1;
  if (synonyms.some((synonym) => sameCompactHeader(value, synonym)))
    return 0.95;
  const words = new Set(value.split(' '));
  let best = 0;
  for (const synonym of synonyms) {
    const parts = synonym.split(' ');
    if (parts.every((part) => words.has(part)))
      best = Math.max(best, 0.6 + 0.3 * (parts.length / words.size));
    else if (value.startsWith(`${synonym} `) || value.endsWith(` ${synonym}`))
      best = Math.max(best, 0.55);
  }
  return Math.min(best, 0.95);
}

/** Digits of a barcode, spaced or in scientific notation (Excel). */
const BARCODE_SHAPE = /^(\d[\d ]{6,16}\d|\d[.,]\d+E\+\d+)$/i;

const share = (values: readonly string[], test: (value: string) => boolean) => {
  const filled = values.filter((value) => value.trim());
  return filled.length ? filled.filter(test).length / filled.length : 0;
};

/** What the values say about a column, whatever its name. */
function valueScore(key: FieldKey, values: readonly string[]) {
  switch (key) {
    case 'ean':
      return share(values, (value) => normalizeEan(value).value !== null);
    case 'imageUrl':
      return share(values, (value) =>
        /^https?:\/\/.+\.(jpe?g|png|webp|gif)(\?|$)/i.test(value.trim()),
      );
    case 'productUrl':
      return share(values, (value) => /^https?:\/\//i.test(value.trim())) * 0.8;
    case 'releaseDate':
    case 'restockDate':
      return (
        share(values, (value) =>
          /^\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(value.trim()),
        ) * 0.5
      );
    default:
      return 0;
  }
}

export function suggestMapping(
  headers: readonly string[],
  sample: readonly (readonly string[])[],
): Suggestion {
  const scores: { key: FieldKey; column: string; score: number }[] = [];
  headers.forEach((header, index) => {
    const values = sample.map((row) => row[index] ?? '');
    for (const field of FIELDS) {
      const byName = nameScore(header, field.synonyms);
      const byValue = valueScore(field.key, values);
      // A name match on a column whose values contradict it (words, not
      // barcodes) is weakened. Codes with a wrong check digit still map:
      // each one is then flagged on its row.
      const score =
        field.key === 'ean' &&
        byName > 0 &&
        share(values, (value) => BARCODE_SHAPE.test(value.trim())) < 0.5 &&
        values.some((v) => v.trim())
          ? byName * 0.4
          : Math.max(byName, byValue);
      if (score >= 0.5) scores.push({ key: field.key, column: header, score });
    }
  });
  scores.sort((a, b) => b.score - a.score);
  const mapping: Mapping = {};
  const confidence: Suggestion['confidence'] = {};
  const used = new Set<string>();
  for (const candidate of scores) {
    if (mapping[candidate.key] || used.has(candidate.column)) continue;
    mapping[candidate.key] = candidate.column;
    confidence[candidate.key] = Math.round(candidate.score * 100) / 100;
    used.add(candidate.column);
  }
  return { mapping, confidence };
}

/** What identifies a file format: its column names, in any order. */
export function signatureSource(headers: readonly string[]) {
  return [...new Set(headers.map(normalizeHeader).filter(Boolean))]
    .sort()
    .join('|');
}

export type InferredOptions = {
  decimal: ',' | '.';
  dateOrder: DateOrder;
  /** False when no date of the file tells day and month apart. */
  dateOrderCertain: boolean;
};

/** Decimal separator and date order, read from the mapped columns. */
export function inferOptions(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  mapping: Mapping,
): InferredOptions {
  const column = (key: FieldKey) => {
    const index = mapping[key] ? headers.indexOf(mapping[key]!) : -1;
    return index < 0 ? [] : rows.map((row) => row[index] ?? '');
  };
  const money = [
    ...column('purchasePrice'),
    ...column('purchasePriceInclTax'),
    ...column('msrp'),
  ];
  const dates = [...column('releaseDate'), ...column('restockDate')];
  const order = inferDateOrder(dates);
  return {
    decimal: inferDecimal(money),
    dateOrder: order.order,
    dateOrderCertain:
      order.certain || !dates.some((value) => /\d[/.-]\d/.test(value)),
  };
}
