import type { AddressValues, ContactValues } from './types';

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly errors: Record<string, string> = {},
  ) {
    super(message);
  }
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const normalize = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
export function validEmail(value: string) {
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return false;
  const [local, domain] = value.split('@');
  return Boolean(
    local &&
    local.length <= 64 &&
    !local.startsWith('.') &&
    !local.endsWith('.') &&
    !local.includes('..') &&
    domain
      ?.split('.')
      .every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)),
  );
}
function validPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return (
    /^\+?[\d(). /-]{6,32}$/.test(value) &&
    digits.length >= 6 &&
    digits.length <= 15
  );
}
function field(
  source: Record<string, unknown>,
  key: string,
  path: string,
  label: string,
  errors: Record<string, string>,
  max = 120,
  required = true,
) {
  const raw = source[key];
  const value = normalize(raw);
  if (
    (raw != null && typeof raw !== 'string') ||
    /[\u0000-\u001f\u007f]/.test(typeof raw === 'string' ? raw : '')
  )
    errors[path] = `${label} contient des caractères non autorisés.`;
  else if (required && !value) errors[path] = `Indiquez ${label}.`;
  else if (value.length > max)
    errors[path] = `${label} doit contenir au maximum ${max} caractères.`;
  return value;
}
function address(
  value: unknown,
  prefix: string,
  countries: readonly string[],
  errors: Record<string, string>,
): AddressValues {
  const source = object(value);
  const read = (key: string, label: string, max = 120, required = true) =>
    field(source, key, `${prefix}.${key}`, label, errors, max, required);
  const result = {
    firstName: read('firstName', 'votre prénom', 80),
    lastName: read('lastName', 'votre nom', 80),
    company: read('company', 'la société', 120, false),
    addressLine1: read('addressLine1', 'votre adresse', 200),
    addressLine2: read('addressLine2', 'le complément', 200, false),
    postalCode: read('postalCode', 'votre code postal', 16),
    city: read('city', 'votre ville'),
    region: read('region', 'la région', 120, false),
    countryCode: read('countryCode', 'votre pays', 2),
    phone: read('phone', 'le téléphone', 32, false),
  };
  if (!countries.includes(result.countryCode))
    errors[`${prefix}.countryCode`] =
      'Ce pays n’est pas actuellement proposé. Choisissez un pays disponible.';
  const pattern =
    result.countryCode === 'FR'
      ? /^\d{5}$/
      : result.countryCode === 'BE'
        ? /^\d{4}$/
        : /^[\p{L}\p{N}][\p{L}\p{N} -]{1,15}$/u;
  if (!pattern.test(result.postalCode))
    errors[`${prefix}.postalCode`] =
      'Indiquez un code postal valide pour ce pays.';
  if (result.phone && !validPhone(result.phone))
    errors[`${prefix}.phone`] = 'Indiquez un numéro de téléphone valide.';
  return result;
}
export function parseContact(
  value: unknown,
  countries: readonly string[],
): ContactValues {
  const source = object(value),
    errors: Record<string, string> = {};
  const email = field(source, 'email', 'email', 'votre email', errors, 254);
  if (!validEmail(email)) errors.email = 'Indiquez une adresse email valide.';
  const phone = field(
    source,
    'phone',
    'phone',
    'votre téléphone',
    errors,
    32,
    false,
  );
  if (phone && !validPhone(phone))
    errors.phone = 'Indiquez un numéro de téléphone valide.';
  if (typeof source.billingSame !== 'boolean')
    errors.billingSame = 'Précisez votre choix pour la facturation.';
  const shipping = address(source.shipping, 'shipping', countries, errors);
  const billingSame = source.billingSame === true;
  const billing = billingSame
    ? null
    : address(source.billing, 'billing', countries, errors);
  if (Object.keys(errors).length)
    throw new CheckoutError(
      'Vérifiez les champs indiqués avant de continuer.',
      errors,
    );
  return { email, phone, billingSame, shipping, billing };
}
export function parseId(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new CheckoutError(
      'Cette session ou cette livraison est introuvable.',
    );
  return value;
}
