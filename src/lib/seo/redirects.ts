import 'server-only';
import { cache } from 'react';
import type { Prisma, SlugEntity } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';

/** Entity that used to answer at `fromSlug`; the caller builds its current URL. */
export const findSlugRedirect = cache(
  async (
    entityType: SlugEntity,
    fromSlug: string,
  ): Promise<{ entityId: string } | null> => {
    if (!fromSlug) return null;
    const redirect = await getPrisma().slugRedirect.findUnique({
      where: { entityType_fromSlug: { entityType, fromSlug } },
      select: { entityId: true },
    });
    return redirect ? { entityId: redirect.entityId } : null;
  },
);

/**
 * Call inside the transaction that renames the entity. Redirects always target
 * the entity id, so successive renames never build chains.
 */
export async function recordSlugChange(
  tx: Prisma.TransactionClient,
  entityType: SlugEntity,
  entityId: string,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (!oldSlug || oldSlug === newSlug) return;
  // The new slug is live again: an older redirect from it would shadow it or loop.
  await tx.slugRedirect.deleteMany({
    where: { entityType, fromSlug: newSlug },
  });
  await tx.slugRedirect.upsert({
    where: { entityType_fromSlug: { entityType, fromSlug: oldSlug } },
    update: { entityId },
    create: { entityType, fromSlug: oldSlug, entityId },
  });
}
