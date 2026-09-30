// Supplier values made comparable: prices, EAN, dates, languages,
// availability… A doubtful value is never corrected silently: it is left
// out and the row carries an issue saying why. Pure module.
import { FIELD_BY_KEY, type FieldKey } from './fields';

export type IssueLevel = 'error' | 'review' | 'info';

export type Issue = {
  field: FieldKey | 'row';
  value: string;
  problem: string;
  suggestion?: string;
  /** error: value unusable; review: a person must look; info: noted only. */
  level: IssueLevel;
};

export type Language = 'FR' | 'EN' | 'JP' | 'DE' | 'ES' | 'IT' | 'OTHER';
export type Availability =
  | 'IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'PREORDER'
  | 'ON_ORDER'
  | 'DISCONTINUED'
  | 'UNKNOWN';

export type NormalizedValues = {
  supplierSku: string | null;
  ean: string | null;
  name: string | null;
  brand: string | null;
  game: string | null;
  series: string | null;
  category: string | null;
  language: Language | null;
  condition: string | null;
  /** Euros excluding VAT, two decimals. */
  purchasePrice: string | null;
  purchasePriceInclTax: string | null;
  msrp: string | null;
  /** Percent, two decimals. */
  vatRate: string | null;
  stock: number | null;
  availability: Availability;
  /** yyyy-mm-dd */
  releaseDate: string | null;
  restockDate: string | null;
  minOrderQty: number | null;
  packaging: string | null;
  packSize: number | null;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
};

export type DateOrder = 'DMY' | 'MDY';

export type NormalizeOptions = {
  /** Decimal separator of the file, inferred per column when « auto ». */
  decimal: ',' | '.';
  dateOrder: DateOrder;
  defaultLanguage: Language | null;
  /** Used to derive the price excluding VAT when only the price with VAT is given. */
  defaultVatRate: string | null;
};

export type Mapping = Partial<Record<FieldKey, string>>;

type Result<T> = { value: T | null; issue?: Omit<Issue, 'field' | 'value'> };

const EMPTY = /^(|-|—|n\/?a|na|nc|n\.c\.|null|none|\?|x)$/i;

export function cleanText(value: string) {
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f​-‍﻿]/g, ' ')
    .replace(/ | /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------ EAN
function gtinChecksumValid(digits: string) {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = 0; index < body.length; index++) {
    const digit = Number(body[body.length - 1 - index]);
    sum += index % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

/** GTIN-8/12/13/14 with a valid check digit, as a 13-digit EAN when possible. */
export function normalizeEan(input: string): Result<string> {
  const value = cleanText(input);
  if (EMPTY.test(value)) return { value: null };
  if (/e\+?\d+$/i.test(value))
    return {
      value: null,
      issue: {
        level: 'error',
        problem: 'EAN tronqué en notation scientifique (réglage Excel)',
        suggestion: 'Formater la colonne en texte chez le fournisseur',
      },
    };
  const digits = value.replace(/[\s.-]/g, '');
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length))
    return { value: null, issue: { level: 'error', problem: 'EAN invalide' } };
  if (!gtinChecksumValid(digits))
    return {
      value: null,
      issue: { level: 'error', problem: 'EAN invalide (clé de contrôle)' },
    };
  if (digits.length === 12) return { value: `0${digits}` };
  if (digits.length === 14 && digits.startsWith('0'))
    return { value: digits.slice(1) };
  return { value: digits };
}

// ------------------------------------------------------------------ numbers
/** Decimal separator used by most values of a column. */
export function inferDecimal(values: readonly string[]): ',' | '.' {
  let comma = 0;
  let dot = 0;
  for (const raw of values) {
    const value = raw.replace(/[^\d.,]/g, '');
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) comma++;
      else dot++;
    } else if (/,\d{1,2}$/.test(value)) comma++;
    else if (/\.\d{1,2}$/.test(value)) dot++;
  }
  return dot > comma ? '.' : ',';
}

/** « 1 234,56 € », « 1,234.56 », « 12.5 EUR HT » → « 1234.56 », « 12.50 ». */
export function normalizeMoney(
  input: string,
  decimal: ',' | '.',
): Result<string> {
  const value = cleanText(input);
  if (EMPTY.test(value)) return { value: null };
  const stripped = value
    .replace(/€|eur(os?)?|\bht\b|\bttc\b|\bhors taxes?\b/gi, '')
    .replace(/\s/g, '');
  if (!/^-?[\d.,']+$/.test(stripped) || !/\d/.test(stripped))
    return {
      value: null,
      issue: { level: 'error', problem: 'Prix impossible à interpréter' },
    };
  if (stripped.startsWith('-'))
    return { value: null, issue: { level: 'error', problem: 'Prix négatif' } };
  const lastComma = stripped.lastIndexOf(',');
  const lastDot = stripped.lastIndexOf('.');
  let separator: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0)
    separator = lastComma > lastDot ? ',' : '.';
  else if (lastComma >= 0 || lastDot >= 0) {
    const found = lastComma >= 0 ? ',' : '.';
    const after = stripped.length - Math.max(lastComma, lastDot) - 1;
    const occurrences = stripped.split(found).length - 1;
    // « 1,234 » or « 1.234 »: thousands or decimals? The file's habit decides,
    // but the row is shown to a person.
    if (after === 3 && occurrences === 1 && found !== decimal)
      return {
        value: null,
        issue: {
          level: 'review',
          problem: `Séparateur ambigu (milliers ou décimales ?)`,
        },
      };
    separator = occurrences > 1 ? null : found;
    if (occurrences > 1 && found === decimal)
      return {
        value: null,
        issue: { level: 'error', problem: 'Prix impossible à interpréter' },
      };
  }
  const normalized = (
    separator
      ? stripped
          .replace(new RegExp(`\\${separator === ',' ? '.' : ','}|'`, 'g'), '')
          .replace(separator, '.')
      : stripped.replace(/[.,']/g, '')
  ).replace(/^0+(?=\d)/, '');
  const number = Number(normalized);
  if (!Number.isFinite(number) || number > 99_999_999)
    return {
      value: null,
      issue: { level: 'error', problem: 'Prix impossible à interpréter' },
    };
  const decimals = normalized.split('.')[1]?.length ?? 0;
  if (decimals > 2)
    return {
      value: null,
      issue: {
        level: 'review',
        problem: 'Prix à plus de deux décimales',
        suggestion: number.toFixed(2).replace('.', ','),
      },
    };
  return { value: number.toFixed(2) };
}

const VAT_RATES = ['0.00', '2.10', '5.50', '10.00', '20.00'];

export function normalizeRate(
  input: string,
  decimal: ',' | '.',
): Result<string> {
  const value = cleanText(input);
  if (EMPTY.test(value)) return { value: null };
  const money = normalizeMoney(value.replace('%', ''), decimal);
  if (money.value === null)
    return {
      value: null,
      issue: { level: 'error', problem: 'Taux de TVA illisible' },
    };
  let rate = Number(money.value);
  // 0,2 in a spreadsheet formatted as a percentage means 20 %.
  if (!value.includes('%') && rate > 0 && rate < 1) rate *= 100;
  const fixed = rate.toFixed(2);
  if (!VAT_RATES.includes(fixed))
    return {
      value: null,
      issue: {
        level: 'review',
        problem: 'Taux de TVA inhabituel en France',
      },
    };
  return { value: fixed };
}

/** « 24 », « 24,0 », « > 100 », « 100+ ». */
export function normalizeInteger(input: string): Result<number> & {
  availability?: Availability;
} {
  const value = cleanText(input);
  if (EMPTY.test(value)) return { value: null };
  const word = availabilityFromText(value);
  if (!/\d/.test(value) && word !== 'UNKNOWN')
    return { value: null, availability: word };
  const minimum =
    /^(>|>=|≥|\+|plus de|sup\.?)\s*(\d[\d\s]*)$|^(\d[\d\s]*)\s*\+$/i.exec(
      value,
    );
  if (minimum) {
    const number = Number((minimum[2] ?? minimum[3]!).replace(/\s/g, ''));
    return {
      value: number,
      issue: {
        level: 'info',
        problem: `Au moins ${number} (valeur minimale retenue)`,
      },
    };
  }
  const plain = value.replace(/\s/g, '').replace(/[,.]0+$/, '');
  if (!/^-?\d+$/.test(plain))
    return {
      value: null,
      issue: { level: 'error', problem: 'Nombre entier attendu' },
    };
  const number = Number(plain);
  if (number < 0)
    return {
      value: null,
      issue: { level: 'error', problem: 'Quantité négative' },
    };
  if (number > 1_000_000)
    return {
      value: null,
      issue: { level: 'error', problem: 'Quantité improbable' },
    };
  return { value: number };
}

// ------------------------------------------------------------------ dates
const MONTHS: Record<string, number> = {
  janvier: 1,
  janv: 1,
  jan: 1,
  january: 1,
  fevrier: 2,
  fevr: 2,
  fev: 2,
  february: 2,
  feb: 2,
  mars: 3,
  march: 3,
  mar: 3,
  avril: 4,
  avr: 4,
  april: 4,
  apr: 4,
  mai: 5,
  may: 5,
  juin: 6,
  june: 6,
  jun: 6,
  juillet: 7,
  juil: 7,
  july: 7,
  jul: 7,
  aout: 8,
  august: 8,
  aug: 8,
  septembre: 9,
  sept: 9,
  sep: 9,
  september: 9,
  octobre: 10,
  oct: 10,
  october: 10,
  novembre: 11,
  nov: 11,
  november: 11,
  decembre: 12,
  dec: 12,
  december: 12,
};

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1990 ||
    year > 2100
  )
    return null;
  return date.toISOString().slice(0, 10);
}

/** Day/month order a column uses: a part above 12 settles it. */
export function inferDateOrder(values: readonly string[]): {
  order: DateOrder;
  certain: boolean;
} {
  let dmy = 0;
  let mdy = 0;
  for (const value of values) {
    const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(
      cleanText(value),
    );
    if (!match) continue;
    if (Number(match[1]) > 12) dmy++;
    else if (Number(match[2]) > 12) mdy++;
  }
  if (mdy > dmy) return { order: 'MDY', certain: true };
  return { order: 'DMY', certain: dmy > 0 };
}

export function normalizeDate(input: string, order: DateOrder): Result<string> {
  const value = cleanText(input);
  if (EMPTY.test(value)) return { value: null };
  if (
    /^(tba|tbd|a venir|à venir|n\.?c\.?|inconnue?|prochainement)$/i.test(value)
  )
    return {
      value: null,
      issue: { level: 'info', problem: 'Date non communiquée' },
    };
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
  if (match) {
    const iso = isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    return iso
      ? { value: iso }
      : { value: null, issue: { level: 'error', problem: 'Date impossible' } };
  }
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
  if (match) {
    const year =
      match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const [day, month] =
      order === 'DMY'
        ? [Number(match[1]), Number(match[2])]
        : [Number(match[2]), Number(match[1])];
    const iso = isoDate(year, month, day);
    return iso
      ? { value: iso }
      : { value: null, issue: { level: 'error', problem: 'Date impossible' } };
  }
  const words = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/);
  const monthIndex = words.findIndex((word) => MONTHS[word]);
  const year = words.find((word) => /^\d{4}$/.test(word));
  if (monthIndex >= 0 && year) {
    const day = words.find(
      (word, index) => index !== monthIndex && /^\d{1,2}$/.test(word),
    );
    if (day) {
      const iso = isoDate(
        Number(year),
        MONTHS[words[monthIndex]!]!,
        Number(day),
      );
      if (iso) return { value: iso };
    }
    return {
      value: null,
      issue: {
        level: 'review',
        problem: 'Date imprécise (mois seulement)',
        suggestion: `${String(MONTHS[words[monthIndex]!]).padStart(2, '0')}/${year}`,
      },
    };
  }
  if (/^(t|q)[1-4]\s*\d{4}$|^\d{4}$|^(s|h)[12]\s*\d{4}$/i.test(value))
    return {
      value: null,
      issue: { level: 'review', problem: 'Date imprécise' },
    };
  return { value: null, issue: { level: 'error', problem: 'Date illisible' } };
}

// ------------------------------------------------------------------ words
const LANGUAGES: [RegExp, Language][] = [
  [/^(fr|fra|fre|francais|french|vf|version francaise)$/, 'FR'],
  [/^(en|eng|anglais|english|uk|us|gb)$/, 'EN'],
  [/^(jp|ja|jpn|jap|japonais|japanese)$/, 'JP'],
  [/^(de|deu|ger|allemand|german|deutsch)$/, 'DE'],
  [/^(es|esp|spa|espagnol|spanish|espanol)$/, 'ES'],
  [/^(it|ita|italien|italian|italiano)$/, 'IT'],
];

export function normalizeLanguage(input: string): Result<Language> {
  const value = cleanText(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (EMPTY.test(value)) return { value: null };
  for (const [pattern, language] of LANGUAGES)
    if (pattern.test(value)) return { value: language };
  if (/^(vo|multi|multilingue|international|int)$/.test(value))
    return {
      value: null,
      issue: { level: 'review', problem: 'Langue imprécise' },
    };
  return {
    value: null,
    issue: { level: 'review', problem: 'Langue inconnue' },
  };
}

/** « (FR) », « – VF », « version française » in a product name. */
export function languageFromName(name: string): Language | null {
  const value = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (
    /(\(|\[|\s|-)(fr|vf)(\)|\]|\s|$)|version francaise|\bfrancais\b/.test(value)
  )
    return 'FR';
  if (
    /(\(|\[|\s|-)(en|eng|uk|us)(\)|\]|\s|$)|english version|\banglais\b/.test(
      value,
    )
  )
    return 'EN';
  if (/(\(|\[|\s|-)(jp|jap)(\)|\]|\s|$)|\bjaponais\b|japanese/.test(value))
    return 'JP';
  return null;
}

export function availabilityFromText(input: string): Availability {
  const value = cleanText(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (
    /^(en stock|stock|disponible|dispo|in stock|available|oui|yes|ok|livrable)$/.test(
      value,
    )
  )
    return 'IN_STOCK';
  if (
    /rupture|epuise|indisponible|out of stock|sold out|^non$|^no$|^0$|^vide$/.test(
      value,
    )
  )
    return 'OUT_OF_STOCK';
  if (
    /precommande|pre-commande|pre-order|preorder|a paraitre|prochainement|coming soon|nouveaute a venir/.test(
      value,
    )
  )
    return 'PREORDER';
  if (
    /sur commande|on order|sur demande|backorder|en reappro|reassort|en commande/.test(
      value,
    )
  )
    return 'ON_ORDER';
  if (
    /arrete|fin de serie|discontinued|plus fabrique|plus disponible|epuise definitivement/.test(
      value,
    )
  )
    return 'DISCONTINUED';
  return 'UNKNOWN';
}

/** « Display de 36 boosters », « carton x6 », « lot de 3 ». */
export function packSizeFrom(input: string) {
  const value = cleanText(input).toLowerCase();
  const match =
    /(?:display|boite|boîte|carton|lot|pack|paquet|colis|case|box)\s*(?:de|of|x)?\s*(\d{1,4})\b/.exec(
      value,
    ) ??
    /\bx\s*(\d{1,4})\b/.exec(value) ??
    /\bpar\s*(\d{1,4})\b/.exec(value) ??
    /^(\d{1,4})\s*(?:boosters|unites|unités|pieces|pièces|pcs|u)\b/.exec(
      value,
    ) ??
    /^(\d{1,4})$/.exec(value);
  if (match) return Number(match[1]);
  if (/^(unite|unité|unit|piece|pièce|seul)$/.test(value)) return 1;
  return null;
}

export function normalizeUrl(input: string): Result<string> {
  const value = cleanText(input);
  if (EMPTY.test(value)) return { value: null };
  try {
    const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return { value: url.toString() };
  } catch {
    return {
      value: null,
      issue: { level: 'error', problem: 'Adresse web invalide' },
    };
  }
}

// ------------------------------------------------------------------ row
const TEXT_LIMITS: Partial<Record<FieldKey, number>> = {
  supplierSku: 64,
  name: 300,
  brand: 120,
  game: 120,
  series: 160,
  category: 160,
  condition: 60,
  description: 5000,
};

/**
 * One supplier row, mapped and normalised. `cells` is keyed by column name.
 */
export function normalizeRow(
  cells: Record<string, string>,
  mapping: Mapping,
  options: NormalizeOptions,
): { values: NormalizedValues; issues: Issue[] } {
  const issues: Issue[] = [];
  const read = (key: FieldKey) => {
    const column = mapping[key];
    return column ? (cells[column] ?? '') : '';
  };
  const take = <T>(
    key: FieldKey,
    result: Result<T>,
    raw = read(key),
  ): T | null => {
    if (result.issue) issues.push({ field: key, value: raw, ...result.issue });
    return result.value;
  };
  const text = (key: FieldKey) => {
    const value = cleanText(read(key));
    if (!value || EMPTY.test(value)) return null;
    const limit = TEXT_LIMITS[key] ?? 500;
    if (value.length > limit) {
      issues.push({
        field: key,
        value: value.slice(0, 60),
        problem: `Texte trop long (plus de ${limit} caractères)`,
        level: 'error',
      });
      return null;
    }
    return value;
  };
  const values: NormalizedValues = {
    supplierSku: text('supplierSku'),
    ean: take('ean', normalizeEan(read('ean'))),
    name: text('name'),
    brand: text('brand'),
    game: text('game'),
    series: text('series'),
    category: text('category'),
    language: take('language', normalizeLanguage(read('language'))),
    condition: text('condition'),
    purchasePrice: take(
      'purchasePrice',
      normalizeMoney(read('purchasePrice'), options.decimal),
    ),
    purchasePriceInclTax: take(
      'purchasePriceInclTax',
      normalizeMoney(read('purchasePriceInclTax'), options.decimal),
    ),
    msrp: take('msrp', normalizeMoney(read('msrp'), options.decimal)),
    vatRate: take('vatRate', normalizeRate(read('vatRate'), options.decimal)),
    stock: null,
    availability: 'UNKNOWN',
    releaseDate: take(
      'releaseDate',
      normalizeDate(read('releaseDate'), options.dateOrder),
    ),
    restockDate: take(
      'restockDate',
      normalizeDate(read('restockDate'), options.dateOrder),
    ),
    minOrderQty: take('minOrderQty', normalizeInteger(read('minOrderQty'))),
    packaging: text('packaging'),
    packSize: null,
    description: text('description'),
    imageUrl: take('imageUrl', normalizeUrl(read('imageUrl'))),
    productUrl: take('productUrl', normalizeUrl(read('productUrl'))),
  };
  const stock = normalizeInteger(read('stock'));
  values.stock = take('stock', stock);
  const rawAvailability = cleanText(read('availability'));
  if (rawAvailability && !EMPTY.test(rawAvailability)) {
    values.availability = availabilityFromText(rawAvailability);
    if (values.availability === 'UNKNOWN')
      issues.push({
        field: 'availability',
        value: rawAvailability,
        problem: 'Disponibilité non reconnue',
        level: 'review',
      });
  } else if (stock.availability) values.availability = stock.availability;
  else if (values.stock !== null)
    values.availability =
      values.stock > 0
        ? 'IN_STOCK'
        : values.releaseDate &&
            values.releaseDate > new Date().toISOString().slice(0, 10)
          ? 'PREORDER'
          : 'OUT_OF_STOCK';
  if (values.packaging) values.packSize = packSizeFrom(values.packaging);
  if (!values.language && values.name) {
    const guessed = languageFromName(values.name);
    if (guessed) {
      values.language = guessed;
      issues.push({
        field: 'language',
        value: values.name,
        problem: 'Langue déduite du nom',
        level: 'info',
      });
    }
  }
  if (!values.language && options.defaultLanguage && !mapping.language)
    values.language = options.defaultLanguage;
  // Excluding VAT derived from the price with VAT, said so on the row.
  if (!values.purchasePrice && values.purchasePriceInclTax) {
    const rate = values.vatRate ?? options.defaultVatRate;
    if (rate) {
      const cents = Math.round(
        (Number(values.purchasePriceInclTax) * 10000) / (100 + Number(rate)),
      );
      values.purchasePrice = (cents / 100).toFixed(2);
      issues.push({
        field: 'purchasePrice',
        value: values.purchasePriceInclTax,
        problem: `Prix HT calculé depuis le TTC (TVA ${rate.replace('.', ',')} %)`,
        level: 'info',
      });
    }
  }
  if (!values.supplierSku && values.ean) {
    values.supplierSku = values.ean;
    issues.push({
      field: 'supplierSku',
      value: values.ean,
      problem: 'Référence fournisseur absente : EAN utilisé comme référence',
      level: 'info',
    });
  }
  if (
    !values.name ||
    values.name.length < 3 ||
    /^[\d\s.,-]+$/.test(values.name)
  )
    issues.push({
      field: 'name',
      value: read('name'),
      problem: 'Nom du produit absent ou inexploitable',
      level: 'error',
    });
  if (!values.supplierSku)
    issues.push({
      field: 'supplierSku',
      value: read('supplierSku'),
      problem: 'Ni référence fournisseur ni EAN',
      level: 'error',
    });
  return { values, issues };
}

export { FIELD_BY_KEY };
