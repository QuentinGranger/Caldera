import type { getPrisma } from '../../src/lib/db/prisma';

/**
 * Issued invoices cannot be deleted (database trigger), except inside a
 * transaction that sets caldera.purge_test_invoices: local tests only.
 */
export async function purgeTestInvoices(
  db: ReturnType<typeof getPrisma>,
  orderIds: string[],
) {
  if (!orderIds.length) return;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('caldera.purge_test_invoices', 'on', true)`;
    await tx.invoice.deleteMany({
      where: { orderId: { in: orderIds }, kind: 'CREDIT_NOTE' },
    });
    await tx.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
  });
}
