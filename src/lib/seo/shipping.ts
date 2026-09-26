import 'server-only';
import { cache } from 'react';
import type { ShippingMethodType } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import type { ShippingMethodInput } from './jsonld';

/**
 * A shipping method offered at checkout, as stored in ShippingMethod. Directly
 * usable as productNode({ shippingMethods }) input and by the /livraison page.
 */
export interface ShippingFact extends ShippingMethodInput {
  code: string;
  name: string;
  description: string | null;
  type: ShippingMethodType;
  /** Decimal strings, e.g. "4.90". */
  price: string;
  freeFromAmount: string | null;
  /** Carrier transit time in business days (ShippingMethod.estimatedMin/MaxDays). */
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  /** Same values under the names read by productNode. */
  minDays: number | null;
  maxDays: number | null;
  /** ISO 3166-1 alpha-2 codes of the active destinations. */
  countries: string[];
  destinations: { code: string; name: string }[];
}

/** Active, non-development methods that serve at least one active country. */
export const getShippingFacts = cache(async (): Promise<ShippingFact[]> => {
  const methods = await getPrisma().shippingMethod.findMany({
    where: {
      isActive: true,
      isDevelopment: false,
      countries: { some: { isActive: true } },
    },
    select: {
      code: true,
      name: true,
      description: true,
      type: true,
      price: true,
      freeFromAmount: true,
      estimatedMinDays: true,
      estimatedMaxDays: true,
      countries: {
        where: { isActive: true },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { code: 'asc' }],
  });
  return methods.map((method) => ({
    code: method.code,
    name: method.name,
    description: method.description,
    type: method.type,
    price: method.price.toFixed(2),
    freeFromAmount: method.freeFromAmount?.toFixed(2) ?? null,
    estimatedMinDays: method.estimatedMinDays,
    estimatedMaxDays: method.estimatedMaxDays,
    minDays: method.estimatedMinDays,
    maxDays: method.estimatedMaxDays,
    countries: method.countries.map((country) => country.code),
    destinations: method.countries.map(({ code, name }) => ({ code, name })),
  }));
});
