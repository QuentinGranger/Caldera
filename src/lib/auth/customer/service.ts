import 'server-only';
import { createHash } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  randomCustomerToken,
} from './crypto';
import { createCustomerSession, destroyCustomerSession } from './session';

export function normalizeCustomerEmail(value: string) {
  return value.trim().toLowerCase();
}

function cleanName(value: string, field: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80)
    throw new Error(`${field} invalide.`);
  return name;
}

export function validateCustomerPassword(value: string) {
  if (value.length < 10 || value.length > 128)
    throw new Error(
      'Le mot de passe doit contenir entre 10 et 128 caractères.',
    );
}

function validEmail(value: string) {
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) && value.length <= 254;
}

export async function registerCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const firstName = cleanName(input.firstName, 'Le prénom');
  const lastName = cleanName(input.lastName, 'Le nom');
  const email = normalizeCustomerEmail(input.email);
  if (!validEmail(email)) throw new Error('Adresse email invalide.');
  validateCustomerPassword(input.password);
  const existing = await getPrisma().customer.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new Error('Un compte utilise déjà cette adresse email.');
  const customer = await getPrisma().customer.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash: await hashCustomerPassword(input.password),
    },
    select: { id: true },
  });
  const token = randomCustomerToken();
  await getPrisma().customerAuthToken.create({
    data: {
      customerId: customer.id,
      tokenHash: token.hash,
      type: 'EMAIL_VERIFICATION',
      email,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await createCustomerSession(customer.id);
  return { customerId: customer.id, verificationToken: token.raw };
}

export async function authenticateCustomer(
  emailInput: string,
  password: string,
) {
  const email = normalizeCustomerEmail(emailInput);
  if (!(await allowCustomerLogin(email))) return null;
  const customer = await getPrisma().customer.findUnique({ where: { email } });
  if (
    !customer ||
    !customer.isActive ||
    !(await verifyCustomerPassword(password, customer.passwordHash))
  )
    return null;
  await getPrisma().customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });
  await createCustomerSession(customer.id);
  // An authenticated customer keeps the cart token but ownership is assigned by the caller.
  return customer;
}

export async function logoutCustomer() {
  await destroyCustomerSession();
}

async function allowCustomerLogin(email: string) {
  const db = getPrisma();
  async function take(key: string, maximum: number, seconds: number) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "CustomerLoginAttempt" (key, count, "windowStart") VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "CustomerLoginAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN 1 ELSE "CustomerLoginAttempt"."count" + 1 END,
        "windowStart" = CASE WHEN "CustomerLoginAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN NOW() ELSE "CustomerLoginAttempt"."windowStart" END
      RETURNING count`;
    return (rows[0]?.count ?? maximum + 1) <= maximum;
  }
  if (!(await take('global', 120, 60))) return false;
  return take(
    `email:${createHash('sha256').update(email).digest('hex')}`,
    8,
    900,
  );
}
