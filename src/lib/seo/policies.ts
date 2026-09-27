// Commercial facts published in structured data. Each value is copied from a
// public page of the site; a fact absent from those pages is left out.

/** Trade name and legal identity, from /mentions-legales (section 1). */
export const ORGANIZATION = {
  name: 'Les Terres de Caldera',
  /** Identifiers and office: LEGAL_IDENTITY. */
  legalName: 'CALDERA',
  path: '/',
  logo: {
    path: '/assets/brand/logo-header.png',
    width: 1916,
    height: 821,
  },
  /** Displayed publicly in /mentions-legales and /cgv. */
  email: 'contact@lesterresdecaldera.fr',
} as const;

/**
 * Registered office and identifiers, shown in /mentions-legales and in the
 * Organization JSON-LD. Fill siren/siret (and vatId if any) once the company is
 * registered: both places update. No shop is open to the public at this address.
 */
export const LEGAL_IDENTITY: {
  legalForm: string;
  address: {
    street: string;
    postalCode: string;
    locality: string;
    country: string;
  };
  siren: string | null;
  siret: string | null;
  vatId: string | null;
} = {
  legalForm: 'Société par actions simplifiée unipersonnelle (SASU)',
  address: {
    street: '74 rue Pierre Valdo',
    postalCode: '69005',
    locality: 'Lyon',
    country: 'FR',
  },
  siren: null,
  siret: null,
  vatId: null,
};

/** Withdrawal and returns, from /cgv articles 10 and 12. */
export const RETURN_POLICY = {
  /** Art. 12.1: 14 days from receipt of the goods. */
  days: 14,
  /** Art. 12.3: goods are sent back to the company address in Lyon. */
  method: 'mail',
  /** Art. 12.3: direct return costs are paid by the customer. */
  fees: 'customer',
  /** Art. 10.1: delivery in metropolitan France only. */
  countries: ['FR'],
  /** Art. 12.3: return address in France. */
  returnCountry: 'FR',
  path: '/cgv#article-12',
} as const;

/** Art. 10.3: orders are prepared and shipped within 1 to 2 business days. */
export const HANDLING_TIME = { minDays: 1, maxDays: 2 } as const;
