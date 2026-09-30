import 'server-only';
import { requireAdmin } from '@/lib/admin/auth';
import type { InvoiceKind, Prisma } from '@/generated/prisma/client';
import { adminTransaction, audit } from '@/lib/admin/common';
import {
  pageNumber,
  pageSize,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import {
  AdminError,
  choice,
  id,
  text,
  whitelist,
} from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { invoiceSettings, issueInvoice, SETTINGS_ID } from './service';

const FIELDS = [
  'legalName',
  'tradeName',
  'legalForm',
  'shareCapital',
  'street',
  'postalCode',
  'city',
  'country',
  'siren',
  'siret',
  'rcsCity',
  'vatNumber',
  'email',
  'vatRegime',
  'defaultVatRate',
  'footer',
] as const;

function digits(form: FormData, key: string, length: number, label: string) {
  const value = text(form, key, 40, false).replace(/\s+/g, '');
  if (value && !new RegExp(`^\\d{${length}}$`).test(value))
    throw new AdminError(`${label} : ${length} chiffres.`);
  return value || null;
}

/** Invoices keep their own copy: only documents issued afterwards change. */
export async function saveInvoiceSettings(adminId: string, form: FormData) {
  whitelist(form, FIELDS);
  const siren = digits(form, 'siren', 9, 'SIREN');
  const siret = digits(form, 'siret', 14, 'SIRET');
  if (siret && siren && !siret.startsWith(siren))
    throw new AdminError('Le SIRET commence par le SIREN.');
  const vatNumber =
    text(form, 'vatNumber', 20, false).replace(/\s+/g, '').toUpperCase() ||
    null;
  if (vatNumber && !/^FR[0-9A-Z]{2}\d{9}$/.test(vatNumber))
    throw new AdminError(
      'Numéro de TVA : FR, deux caractères de clé et le SIREN (13 caractères).',
    );
  const rate = text(form, 'defaultVatRate', 6).replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(rate) || Number(rate) > 30)
    throw new AdminError('Taux de TVA invalide (0 à 30 %).');
  const email = text(form, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AdminError('Adresse e-mail invalide.');
  const vatRegime = choice(form, 'vatRegime', ['FRANCHISE', 'STANDARD']);
  if (vatRegime === 'STANDARD' && !vatNumber)
    throw new AdminError(
      'Un numéro de TVA intracommunautaire est obligatoire pour facturer la TVA.',
    );
  const data = {
    legalName: text(form, 'legalName', 120),
    tradeName: text(form, 'tradeName', 120),
    legalForm: text(form, 'legalForm', 80),
    shareCapital: text(form, 'shareCapital', 40, false) || null,
    street: text(form, 'street', 160),
    postalCode: text(form, 'postalCode', 12),
    city: text(form, 'city', 80),
    country: text(form, 'country', 60),
    siren,
    siret,
    rcsCity: text(form, 'rcsCity', 80, false) || null,
    vatNumber,
    email,
    vatRegime,
    defaultVatRate: rate,
    footer: text(form, 'footer', 1000, false) || null,
  };
  return adminTransaction(adminId, async (tx) => {
    const before = await invoiceSettings(tx);
    const saved = await tx.invoiceSettings.update({
      where: { id: SETTINGS_ID },
      data,
    });
    // The settings row has no UUID: a fixed one identifies it in the log.
    await audit(
      tx,
      adminId,
      'INVOICE_SETTINGS_UPDATED',
      'InvoiceSettings',
      '00000000-0000-4000-8000-000000000000',
      { vatRegime: saved.vatRegime, previousVatRegime: before.vatRegime },
    );
    return saved;
  });
}

/** For an order paid before invoices existed, or left in review then paid. */
export async function issueMissingInvoice(adminId: string, form: FormData) {
  whitelist(form, ['id']);
  const orderId = id(form)!;
  return adminTransaction(adminId, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, payment: { select: { status: true } } },
    });
    if (order?.status !== 'PAID' || order.payment?.status !== 'SUCCEEDED')
      throw new AdminError('Seule une commande payée peut être facturée.');
    const invoice = await issueInvoice(tx, orderId);
    await audit(tx, adminId, 'INVOICE_ISSUED', 'Order', orderId, {
      number: invoice.number,
    });
    return invoice;
  });
}

export async function getAdminInvoices(params: SearchParams) {
  await requireAdmin();
  const kind = (['INVOICE', 'CREDIT_NOTE'] as const).find(
    (value) => value === param(params, 'kind'),
  ) as InvoiceKind | undefined;
  const year = /^\d{4}$/.test(param(params, 'year'))
    ? Number(param(params, 'year'))
    : null;
  const search = param(params, 'search').trim();
  const where: Prisma.InvoiceWhereInput = {
    ...(kind ? { kind } : {}),
    ...(year
      ? {
          number: { contains: `-${year}-` },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: 'insensitive' } },
            {
              order: {
                orderNumber: { contains: search, mode: 'insensitive' },
              },
            },
            { order: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const page = pageNumber(params);
  const db = getPrisma();
  const [rows, total, sums] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { number: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: { select: { id: true, orderNumber: true, email: true } },
        invoice: { select: { number: true } },
      },
    }),
    db.invoice.count({ where }),
    db.invoice.groupBy({
      by: ['kind'],
      where,
      _sum: { totalAmount: true, taxAmount: true },
      _count: { _all: true },
    }),
  ]);
  return { rows, total, page, sums };
}

export { invoiceSettings };
