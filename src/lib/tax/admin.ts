import 'server-only';
import { adminTransaction, audit } from '@/lib/admin/common';
import { parisDate } from '@/lib/admin/dates';
import { AdminError, checked, text, whitelist } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { invoiceSettings, SETTINGS_ID } from '@/lib/invoices/service';
import { toCents } from '@/lib/refunds/amounts';

type MonthRow = { month: string; orders: number; amount: string | null };

/** Paid sales minus confirmed refunds, per month of a Paris calendar year. */
export async function turnover(year: number) {
  const start = parisDate(`${year}-01-01`)!;
  const end = parisDate(`${year + 1}-01-01`)!;
  const db = getPrisma();
  const [sales, refunds] = await Promise.all([
    db.$queryRaw<MonthRow[]>`
      SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris', 'YYYY-MM') AS month,
             COUNT(*)::int AS orders, SUM("totalAmount")::text AS amount
      FROM "Order"
      WHERE status = 'PAID' AND "paidAt" >= ${start} AND "paidAt" < ${end}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<MonthRow[]>`
      SELECT to_char(("succeededAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris', 'YYYY-MM') AS month,
             COUNT(*)::int AS orders, SUM("amount")::text AS amount
      FROM "Refund"
      WHERE status = 'SUCCEEDED' AND "succeededAt" >= ${start} AND "succeededAt" < ${end}
      GROUP BY 1 ORDER BY 1`,
  ]);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const sale = sales.find((row) => row.month === month);
    const refund = refunds.find((row) => row.month === month);
    const salesCents = sale?.amount
      ? toCents(Number(sale.amount).toFixed(2))
      : 0;
    const refundCents = refund?.amount
      ? toCents(Number(refund.amount).toFixed(2))
      : 0;
    return {
      month,
      orders: sale?.orders ?? 0,
      salesCents,
      refundCents,
      netCents: salesCents - refundCents,
    };
  });
  return {
    months,
    totalCents: months.reduce((sum, row) => sum + row.netCents, 0),
  };
}

const TAX_CODE = /^txcd_\d{8}$/;

function euros(form: FormData, key: string, label: string) {
  const value = text(form, key, 14).replace(/\s+/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value) || Number(value) <= 0)
    throw new AdminError(`${label} : montant invalide.`);
  return value;
}

export async function saveTaxSettings(adminId: string, form: FormData) {
  whitelist(form, [
    'stripeTaxEnabled',
    'productTaxCode',
    'shippingTaxCode',
    'franchiseThreshold',
    'franchiseMajoredThreshold',
  ]);
  const productTaxCode = text(form, 'productTaxCode', 20);
  const shippingTaxCode = text(form, 'shippingTaxCode', 20);
  if (!TAX_CODE.test(productTaxCode) || !TAX_CODE.test(shippingTaxCode))
    throw new AdminError(
      'Code fiscal Stripe invalide : « txcd_ » et 8 chiffres.',
    );
  const franchiseThreshold = euros(form, 'franchiseThreshold', 'Seuil de base');
  const franchiseMajoredThreshold = euros(
    form,
    'franchiseMajoredThreshold',
    'Seuil majoré',
  );
  if (Number(franchiseMajoredThreshold) < Number(franchiseThreshold))
    throw new AdminError(
      'Le seuil majoré ne peut pas être inférieur au seuil de base.',
    );
  const stripeTaxEnabled = checked(form, 'stripeTaxEnabled');
  return adminTransaction(adminId, async (tx) => {
    const current = await invoiceSettings(tx);
    if (stripeTaxEnabled && current.vatRegime !== 'STANDARD')
      throw new AdminError(
        'Stripe Tax calcule de la TVA : il ne s’active qu’au régime assujetti (Factures → Mentions légales). En franchise, aucune TVA ne doit être facturée.',
      );
    const saved = await tx.invoiceSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        stripeTaxEnabled,
        productTaxCode,
        shippingTaxCode,
        franchiseThreshold,
        franchiseMajoredThreshold,
      },
    });
    await audit(
      tx,
      adminId,
      'TAX_SETTINGS_UPDATED',
      'InvoiceSettings',
      '00000000-0000-4000-8000-000000000000',
      {
        stripeTaxEnabled,
        previousStripeTaxEnabled: current.stripeTaxEnabled,
      },
    );
    return saved;
  });
}
