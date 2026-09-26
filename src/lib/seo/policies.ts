// Commercial facts published in structured data. Each value is copied from a
// public page of the site; a fact absent from those pages is left out.

/** Trade name and legal identity, from /mentions-legales (section 1). */
export const ORGANIZATION = {
  name: 'Les Terres de Caldera',
  /** SIREN/SIRET and address are omitted until the company is registered. */
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
