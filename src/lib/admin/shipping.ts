import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from './auth';
import { adminTransaction, audit } from './common';
import {
  AdminError,
  checked,
  id,
  integer,
  money,
  text,
  whitelist,
} from './validation';

/** Every method and destination, as the checkout and /livraison read them. */
export async function getAdminShipping() {
  await requireAdmin();
  const db = getPrisma();
  const [methods, countries] = await Promise.all([
    db.shippingMethod.findMany({
      orderBy: [
        { isDevelopment: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        countries: { select: { code: true } },
        _count: { select: { checkouts: true } },
      },
    }),
    db.shippingCountry.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return { methods, countries };
}

function days(form: FormData, key: string) {
  const value = text(form, key, 3, false);
  if (!value) return null;
  if (!/^\d{1,2}$/.test(value) || Number(value) > 60)
    throw new AdminError('Délai invalide : de 0 à 60 jours ouvrés.');
  return Number(value);
}

/**
 * An existing method: what the customer reads and pays. Codes, types and new
 * methods stay with the developer (carriers and fulfillment rely on them).
 */
export async function saveShippingMethod(adminId: string, form: FormData) {
  const countryCodes = [...form.keys()].filter((key) =>
    /^country:[A-Z]{2}$/.test(key),
  );
  whitelist(form, [
    'id',
    'name',
    'description',
    'price',
    'freeFromAmount',
    'estimatedMinDays',
    'estimatedMaxDays',
    'sortOrder',
    'isActive',
    ...countryCodes,
  ]);
  const methodId = id(form)!;
  const data = {
    name: text(form, 'name', 80),
    description: text(form, 'description', 300, false) || null,
    price: money(form, 'price')!,
    freeFromAmount: money(form, 'freeFromAmount', true),
    estimatedMinDays: days(form, 'estimatedMinDays'),
    estimatedMaxDays: days(form, 'estimatedMaxDays'),
    sortOrder: integer(form, 'sortOrder', 0, 999),
    isActive: checked(form, 'isActive'),
  };
  if (data.freeFromAmount?.lte(0))
    throw new AdminError(
      'Seuil de gratuité invalide : laissez vide pour ne jamais offrir la livraison.',
    );
  if (
    data.estimatedMinDays !== null &&
    data.estimatedMaxDays !== null &&
    data.estimatedMinDays > data.estimatedMaxDays
  )
    throw new AdminError('Le délai minimum dépasse le délai maximum.');
  const countries = countryCodes.map((key) => {
    checked(form, key);
    return key.slice('country:'.length);
  });
  return adminTransaction(adminId, async (tx) => {
    const before = await tx.shippingMethod.findUnique({
      where: { id: methodId },
      include: { countries: { select: { code: true } } },
    });
    if (!before) throw new AdminError('Mode de livraison introuvable.');
    const known = await tx.shippingCountry.count({
      where: { code: { in: countries } },
    });
    if (known !== countries.length) throw new AdminError('Pays inconnu.');
    if (data.isActive && !countries.length)
      throw new AdminError('Un mode actif doit desservir au moins un pays.');
    const method = await tx.shippingMethod.update({
      where: { id: methodId },
      data: {
        ...data,
        countries: { set: countries.map((code) => ({ code })) },
      },
    });
    await audit(
      tx,
      adminId,
      'SHIPPING_METHOD_UPDATED',
      'ShippingMethod',
      method.id,
      {
        code: method.code,
        price: {
          before: before.price.toFixed(2),
          after: method.price.toFixed(2),
        },
        freeFromAmount: {
          before: before.freeFromAmount?.toFixed(2) ?? null,
          after: method.freeFromAmount?.toFixed(2) ?? null,
        },
        isActive: { before: before.isActive, after: method.isActive },
        countries: {
          before: before.countries.map((country) => country.code).sort(),
          after: countries.sort(),
        },
      },
    );
    return method;
  });
}

/** Which destinations the shop delivers at all. */
export async function saveShippingCountries(adminId: string, form: FormData) {
  const keys = [...form.keys()].filter((key) => /^active:[A-Z]{2}$/.test(key));
  whitelist(form, keys);
  const active = keys.map((key) => {
    checked(form, key);
    return key.slice('active:'.length);
  });
  return adminTransaction(adminId, async (tx) => {
    const countries = await tx.shippingCountry.findMany();
    if (active.some((code) => !countries.some((row) => row.code === code)))
      throw new AdminError('Pays inconnu.');
    if (!active.length)
      throw new AdminError(
        'Au moins un pays doit rester ouvert : sans lui, plus aucune commande possible.',
      );
    for (const country of countries)
      if (country.isActive !== active.includes(country.code))
        await tx.shippingCountry.update({
          where: { code: country.code },
          data: { isActive: active.includes(country.code) },
        });
    // Settings without an id of their own: the convention of InvoiceSettings.
    await audit(
      tx,
      adminId,
      'SHIPPING_COUNTRIES_UPDATED',
      'ShippingCountry',
      '00000000-0000-4000-8000-000000000000',
      {
        before: countries.filter((row) => row.isActive).map((row) => row.code),
        after: active.sort(),
      },
    );
  });
}
