import { Prisma } from '@/generated/prisma/client';
import { createSlug } from '@/lib/catalog/createSlug';
export class AdminError extends Error {}
export function text(form: FormData, key: string, max = 200, required = true) {
  const value = form.get(key);
  if (value !== null && typeof value !== 'string')
    throw new AdminError(`Champ ${key} invalide.`);
  const result = (value ?? '').trim();
  if (result.length > max || (required && !result))
    throw new AdminError(`Champ ${key} requis ou trop long (maximum ${max}).`);
  return result;
}
export function uuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new AdminError('Identifiant invalide.');
  return value;
}
export function id(form: FormData, key = 'id', optional = false) {
  const value = text(form, key, 36, !optional);
  return value ? uuid(value) : undefined;
}
export function choice<T extends string>(
  form: FormData,
  key: string,
  choices: readonly T[],
): T {
  const value = text(form, key);
  const result = choices.find((item) => item === value);
  if (!result) throw new AdminError(`Valeur ${key} invalide.`);
  return result;
}
export function integer(form: FormData, key: string, min = 0, max = 1000000) {
  const value = text(form, key);
  if (
    !/^-?\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new AdminError(`Quantité ${key} invalide (${min} à ${max}).`);
  return Number(value);
}
export function money(form: FormData, key: string, optional = false) {
  const value = text(form, key, 20, !optional).replace(',', '.');
  if (!value && optional) return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new AdminError(`Montant ${key} invalide : deux décimales maximum.`);
  return new Prisma.Decimal(value);
}
export function checked(form: FormData, key: string) {
  const value = form.get(key);
  if (value === null) return false;
  if (value !== 'on') throw new AdminError(`Option ${key} invalide.`);
  return true;
}
export function date(form: FormData, key: string) {
  const value = text(form, key, 10, false);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AdminError(`Date ${key} invalide.`);
  const result = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value
  )
    throw new AdminError(`Date ${key} invalide.`);
  return result;
}
export function slug(form: FormData, name: string) {
  const value = text(form, 'slug', 180, false) || createSlug(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    throw new AdminError(
      'Slug : lettres minuscules, chiffres et tirets uniquement.',
    );
  return value;
}
export function localImage(form: FormData, key: string) {
  const value = text(form, key, 500, false);
  if (
    value &&
    !/^\/(?:assets\/[a-zA-Z0-9_./-]+|media\/[a-f0-9-]+\.webp)$/.test(value)
  )
    throw new AdminError('Utilisez une image locale /assets/ ou /media/.');
  if (value.includes('..')) throw new AdminError('Chemin image invalide.');
  return value || null;
}
export function whitelist(form: FormData, fields: readonly string[]) {
  for (const key of form.keys())
    if (!fields.includes(key) && !key.startsWith('$ACTION_'))
      throw new AdminError(`Champ non autorisé : ${key.slice(0, 50)}.`);
}
