import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from './auth';
import { adminTransaction, audit } from './common';
import { pageNumber, pageSize, param, type SearchParams } from './queries';
import { AdminError } from './validation';

const DAY_MS = 86400000;

/** The /contact messages, by state: to handle, handled, all. */
export async function getAdminMessages(params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const view = param(params, 'view') || 'open';
  const search = param(params, 'search').trim();
  const where: Prisma.ContactMessageWhereInput = {
    ...(view === 'open'
      ? { handledAt: null }
      : view === 'handled'
        ? { handledAt: { not: null } }
        : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { orderNumber: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const page = pageNumber(params);
  const [messages, total, open] = await Promise.all([
    db.contactMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: { handledBy: { select: { name: true } } },
    }),
    db.contactMessage.count({ where }),
    db.contactMessage.count({ where: { handledAt: null } }),
  ]);
  return { messages, total, page, open, view };
}

/** Messages nobody has answered yet, for the navigation and the dashboard. */
export async function countOpenMessages() {
  await requireAdmin();
  return getPrisma().contactMessage.count({ where: { handledAt: null } });
}

/** Answered (or nothing to answer), or back on the list. */
export async function setMessageHandled(
  adminId: string,
  messageId: string,
  handled: boolean,
) {
  return adminTransaction(adminId, async (tx) => {
    const current = await tx.contactMessage.findUnique({
      where: { id: messageId },
      select: { id: true, handledAt: true },
    });
    if (!current) throw new AdminError('Message introuvable.');
    if (Boolean(current.handledAt) === handled) return current;
    await audit(
      tx,
      adminId,
      handled ? 'CONTACT_MESSAGE_HANDLED' : 'CONTACT_MESSAGE_REOPENED',
      'ContactMessage',
      messageId,
    );
    return tx.contactMessage.update({
      where: { id: messageId },
      data: handled
        ? { handledAt: new Date(), handledById: adminId }
        : { handledAt: null, handledById: null },
      select: { id: true, handledAt: true },
    });
  });
}

/** Kept a year after being handled, two at most if never handled. */
export async function purgeContactMessages(now = new Date()) {
  const { count } = await getPrisma().contactMessage.deleteMany({
    where: {
      OR: [
        { handledAt: { lt: new Date(now.getTime() - 365 * DAY_MS) } },
        { createdAt: { lt: new Date(now.getTime() - 730 * DAY_MS) } },
      ],
    },
  });
  return { messagesPurged: count };
}
