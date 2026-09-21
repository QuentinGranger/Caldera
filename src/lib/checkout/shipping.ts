import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { CheckoutError } from './schemas';
export type ShippingRule = {
  id: string;
  code: string;
  type: 'HOME_DELIVERY' | 'EXPRESS' | 'PICKUP';
  name: string;
  description: string | null;
  isActive: boolean;
  isDevelopment: boolean;
  price: Prisma.Decimal;
  freeFromAmount: Prisma.Decimal | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  countries: { code: string; isActive: boolean }[];
};
export function calculateShipping(
  method: ShippingRule,
  countryCode: string,
  subtotal: Prisma.Decimal,
) {
  if (
    !method.isActive ||
    !method.countries.some(
      (country) => country.code === countryCode && country.isActive,
    )
  )
    throw new CheckoutError(
      'Ce mode de livraison n’est plus disponible pour votre destination.',
    );
  return method.freeFromAmount !== null && subtotal.gte(method.freeFromAmount)
    ? new Prisma.Decimal(0)
    : method.price;
}
export function getAvailableShippingMethods(
  methods: ShippingRule[],
  countryCode: string,
  subtotal: Prisma.Decimal,
) {
  return methods
    .filter(
      (method) =>
        method.isActive &&
        method.countries.some(
          (country) => country.code === countryCode && country.isActive,
        ),
    )
    .map((method) => ({
      id: method.id,
      code: method.code,
      type: method.type,
      name: method.name,
      description: method.description,
      amount: calculateShipping(method, countryCode, subtotal).toFixed(2),
      estimatedMinDays: method.estimatedMinDays,
      estimatedMaxDays: method.estimatedMaxDays,
      isDevelopment: method.isDevelopment,
    }));
}
