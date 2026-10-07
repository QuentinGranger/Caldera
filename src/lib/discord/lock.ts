import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';

/** Serialize grant/retry/unlink across server instances for this customer. */
export function withDiscordCustomerLock<T>(
  customerId: string,
  operation: (db: Prisma.TransactionClient) => Promise<T>,
) {
  return getPrisma().$transaction(
    async (db) => {
      const customer = await db.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Customer" WHERE "id" = ${customerId}::uuid FOR UPDATE`;
      if (customer.length !== 1) throw new Error('Compte indisponible.');
      return operation(db);
    },
    { maxWait: 3000, timeout: 20000 },
  );
}
