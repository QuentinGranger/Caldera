// Caldera fields a supplier column can feed, with the names suppliers give
// them. Pure module: mapping, normalisation, pages and tests.

export type FieldType =
  | 'text'
  | 'sku'
  | 'ean'
  | 'money'
  | 'rate'
  | 'integer'
  | 'date'
  | 'language'
  | 'availability'
  | 'packaging'
  | 'url';

export type FieldKey =
  | 'supplierSku'
  | 'ean'
  | 'name'
  | 'brand'
  | 'game'
  | 'series'
  | 'category'
  | 'language'
  | 'condition'
  | 'purchasePrice'
  | 'purchasePriceInclTax'
  | 'msrp'
  | 'vatRate'
  | 'stock'
  | 'availability'
  | 'releaseDate'
  | 'restockDate'
  | 'minOrderQty'
  | 'packaging'
  | 'description'
  | 'imageUrl'
  | 'productUrl';

export type FieldDefinition = {
  key: FieldKey;
  label: string;
  type: FieldType;
  /** Column names, without accents, lower case, words separated by spaces. */
  synonyms: string[];
};

export const FIELDS: readonly FieldDefinition[] = [
  {
    key: 'supplierSku',
    label: 'Référence fournisseur',
    type: 'sku',
    synonyms: [
      'reference',
      'ref',
      'reference fournisseur',
      'ref fournisseur',
      'ref fourn',
      'sku',
      'code article',
      'code produit',
      'code',
      'product id',
      'item number',
      'item no',
      'item',
      'article',
      'code fournisseur',
      'part number',
      'reference article',
    ],
  },
  {
    key: 'ean',
    label: 'EAN / GTIN',
    type: 'ean',
    synonyms: [
      'ean',
      'ean13',
      'ean 13',
      'gtin',
      'gencod',
      'gencode',
      'code barre',
      'code barres',
      'barcode',
      'upc',
      'code ean',
    ],
  },
  {
    key: 'name',
    label: 'Nom du produit',
    type: 'text',
    synonyms: [
      'designation',
      'libelle',
      'nom',
      'nom produit',
      'produit',
      'product',
      'product name',
      'name',
      'title',
      'titre',
      'intitule',
      'description courte',
    ],
  },
  {
    key: 'brand',
    label: 'Marque / licence',
    type: 'text',
    synonyms: [
      'marque',
      'licence',
      'license',
      'brand',
      'editeur',
      'fabricant',
      'manufacturer',
      'publisher',
    ],
  },
  {
    key: 'game',
    label: 'Gamme / jeu',
    type: 'text',
    synonyms: [
      'gamme',
      'jeu',
      'game',
      'univers',
      'tcg',
      'franchise',
      'ligne',
      'line',
    ],
  },
  {
    key: 'series',
    label: 'Extension / série',
    type: 'text',
    synonyms: [
      'extension',
      'serie',
      'series',
      'set',
      'collection',
      'bloc',
      'edition',
    ],
  },
  {
    key: 'category',
    label: 'Catégorie',
    type: 'text',
    synonyms: [
      'categorie',
      'category',
      'famille',
      'sous famille',
      'type',
      'type produit',
      'product type',
    ],
  },
  {
    key: 'language',
    label: 'Langue',
    type: 'language',
    synonyms: ['langue', 'lang', 'language', 'version', 'vf vo'],
  },
  {
    key: 'condition',
    label: 'État',
    type: 'text',
    synonyms: ['etat', 'condition', 'state'],
  },
  {
    key: 'purchasePrice',
    label: 'Prix d’achat HT',
    type: 'money',
    synonyms: [
      'prix achat ht',
      'pa ht',
      'prix ht',
      'prix net',
      'prix net ht',
      'tarif ht',
      'prix revendeur',
      'prix revendeur ht',
      'purchase price',
      'cost',
      'cost price',
      'wholesale',
      'wholesale price',
      'net price',
      'prix unitaire ht',
      'pu ht',
      'prix',
    ],
  },
  {
    key: 'purchasePriceInclTax',
    label: 'Prix d’achat TTC',
    type: 'money',
    synonyms: ['prix achat ttc', 'pa ttc', 'prix ttc', 'tarif ttc', 'pu ttc'],
  },
  {
    key: 'msrp',
    label: 'Prix public conseillé',
    type: 'money',
    synonyms: [
      'pvc',
      'ppc',
      'pvp',
      'prix public',
      'prix public ttc',
      'prix conseille',
      'prix de vente conseille',
      'prix vente conseille',
      'msrp',
      'rrp',
      'retail price',
      'srp',
    ],
  },
  {
    key: 'vatRate',
    label: 'TVA',
    type: 'rate',
    synonyms: [
      'tva',
      'taux tva',
      'taux de tva',
      'vat',
      'vat rate',
      'tax',
      'taxe',
    ],
  },
  {
    key: 'stock',
    label: 'Quantité disponible',
    type: 'integer',
    synonyms: [
      'stock',
      'stock dispo',
      'stock disponible',
      'quantite',
      'quantite disponible',
      'qte',
      'qte dispo',
      'qty',
      'quantity',
      'available quantity',
      'inventory',
      'dispo',
    ],
  },
  {
    key: 'availability',
    label: 'Disponibilité',
    type: 'availability',
    synonyms: [
      'disponibilite',
      'statut',
      'status',
      'availability',
      'etat stock',
      'etat du stock',
      'stock status',
    ],
  },
  {
    key: 'releaseDate',
    label: 'Date de sortie',
    type: 'date',
    synonyms: [
      'date de sortie',
      'sortie',
      'date sortie',
      'release date',
      'release',
      'date parution',
      'parution',
    ],
  },
  {
    key: 'restockDate',
    label: 'Date de réassort',
    type: 'date',
    synonyms: [
      'reassort',
      'date de reassort',
      'date reassort',
      'restock',
      'restock date',
      'retour stock',
      'eta',
      'date dispo',
      'date disponibilite',
    ],
  },
  {
    key: 'minOrderQty',
    label: 'Minimum de commande',
    type: 'integer',
    synonyms: [
      'minimum de commande',
      'minimum commande',
      'qte min',
      'quantite minimum',
      'moq',
      'minimum',
      'min order',
      'minimum order',
    ],
  },
  {
    key: 'packaging',
    label: 'Conditionnement',
    type: 'packaging',
    synonyms: [
      'conditionnement',
      'packaging',
      'unite de vente',
      'format',
      'colisage',
      'pack',
      'carton',
      'uv',
    ],
  },
  {
    key: 'description',
    label: 'Description',
    type: 'text',
    synonyms: [
      'description',
      'descriptif',
      'detail',
      'details',
      'description longue',
    ],
  },
  {
    key: 'imageUrl',
    label: 'Image (URL)',
    type: 'url',
    synonyms: [
      'image',
      'photo',
      'visuel',
      'image url',
      'url image',
      'picture',
      'lien image',
    ],
  },
  {
    key: 'productUrl',
    label: 'URL produit fournisseur',
    type: 'url',
    synonyms: [
      'lien',
      'url',
      'url produit',
      'product url',
      'fiche produit',
      'link',
      'lien produit',
    ],
  },
];

export const FIELD_BY_KEY = Object.fromEntries(
  FIELDS.map((field) => [field.key, field]),
) as Record<FieldKey, FieldDefinition>;

/** Column name as compared with the synonyms. */
export function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const compact = (value: string) => value.replace(/ /g, '');

const KNOWN_HEADERS = new Set(
  FIELDS.flatMap((field) => field.synonyms.flatMap((s) => [s, compact(s)])),
);

/** A known column name, spaces lost or not (OCR reads « PA HT » as « PAHT »). */
export function isKnownHeader(value: string) {
  const header = normalizeHeader(value);
  return (
    Boolean(header) &&
    (KNOWN_HEADERS.has(header) || KNOWN_HEADERS.has(compact(header)))
  );
}

/** Same name once spaces are ignored. */
export function sameCompactHeader(header: string, synonym: string) {
  return compact(header) === compact(synonym);
}
