import 'server-only';
import { randomBytes } from 'node:crypto';
import type {
  Prisma,
  ReturnReason,
  ReturnStatus,
} from '@/generated/prisma/client';
import { adminTransaction, audit } from '@/lib/admin/common';
import { changeStock } from '@/lib/admin/inventory';
import { AdminError } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { enqueueOrderEmail } from '@/lib/email/outbox';
import { notifyShop } from '@/lib/email/shop';
import { lockOrder, transaction } from '@/lib/orders/common';
import { refundState } from '@/lib/refunds/amounts';
import type { RefundGateway } from '@/lib/refunds/gateway';
import { requestRefund } from '@/lib/refunds/service';
import { MAX_RETURN_PHOTOS } from './photos';
import {
  canMoveReturn,
  canReportProblem,
  canWithdraw,
  OPEN_RETURN_STATUSES,
  refundReasonForReturn,
  returnableQuantities,
  returnReasonLabels,
  withdrawalDeadline,
} from './rules';

const deadlineFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

/** Refused request, in words the customer or the administrator can act on. */
export class ReturnError extends Error {}

/** What is left to return on a paid order, line by line. */
export async function returnableLines(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      payment: true,
      items: { orderBy: { id: 'asc' } },
      returns: { include: { items: true } },
      refunds: {
        include: {
          items: { select: { orderItemId: true, quantity: true } },
          returnRequest: { select: { status: true } },
        },
      },
    },
  });
  const openReturns = order.returns.filter((request) =>
    OPEN_RETURN_STATUSES.includes(request.status),
  );
  // Refunds tied to a return still being handled are counted with it.
  const outside = order.refunds.filter(
    (refund) =>
      !refund.returnRequest ||
      !OPEN_RETURN_STATUSES.includes(refund.returnRequest.status),
  );
  const refunded = order.payment
    ? refundState(
        {
          amount: order.payment.amount.toFixed(2),
          shipping: order.shippingAmount.toFixed(2),
        },
        outside,
      ).refundedQuantities
    : new Map<string, number>();
  const left = returnableQuantities(order.items, openReturns, refunded);
  return {
    order,
    lines: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      left: left.get(item.id) ?? 0,
    })),
  };
}

function returnNumber() {
  return `RET-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function emailInput(request: {
  id: string;
  number: string;
  reason: ReturnReason;
  createdAt: Date;
  resolution: string | null;
  items: { quantity: number; orderItem: { productName: string } }[];
}) {
  return {
    id: request.id,
    number: request.number,
    reason: returnReasonLabels[request.reason],
    withdrawal: request.reason === 'WITHDRAWAL',
    requestedAt: request.createdAt.toISOString(),
    items: request.items.map((item) => ({
      name: item.orderItem.productName,
      quantity: item.quantity,
    })),
    resolution: request.resolution,
  };
}

const withItems = {
  items: { include: { orderItem: { select: { productName: true } } } },
} as const;

export type NewReturn = {
  orderId: string;
  reason: ReturnReason;
  items: { orderItemId: string; quantity: number }[];
  message: string;
  /** Photos already stored (src/lib/returns/photos.ts), by file name. */
  photos?: string[];
};

/**
 * Records a return. The customer is held to the legal periods; the shop may
 * record any request it accepted by e-mail or phone.
 */
async function createReturnIn(
  tx: Prisma.TransactionClient,
  input: NewReturn,
  by: { adminId: string; notify: boolean } | null,
) {
  await lockOrder(tx, input.orderId);
  const { order, lines } = await returnableLines(tx, input.orderId);
  if (order.status !== 'PAID' || order.payment?.status !== 'SUCCEEDED')
    throw new ReturnError(
      'Seule une commande payée peut faire l’objet d’un retour.',
    );
  if (!by) {
    if (input.reason === 'WITHDRAWAL' && !canWithdraw(order.deliveredAt))
      throw new ReturnError(
        `Le délai de rétractation a pris fin le ${deadlineFormat.format(
          new Date(withdrawalDeadline(order.deliveredAt)!.getTime() - 1),
        )}. Pour un article abîmé ou défectueux, choisissez le motif correspondant.`,
      );
    if (input.reason !== 'WITHDRAWAL' && !canReportProblem(order))
      throw new ReturnError(
        'Cette commande n’est plus couverte par la garantie légale de deux ans.',
      );
  }
  const seen = new Set<string>();
  const items = [];
  for (const item of input.items) {
    if (!item.quantity) continue;
    if (seen.has(item.orderItemId))
      throw new ReturnError('Formulaire invalide : rechargez la page.');
    seen.add(item.orderItemId);
    const line = lines.find((row) => row.id === item.orderItemId);
    if (!line)
      throw new ReturnError('Article introuvable dans cette commande.');
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 0 ||
      item.quantity > line.left
    )
      throw new ReturnError(
        line.left
          ? `« ${line.name} » : ${line.left} au plus.`
          : `« ${line.name} » est déjà retourné ou remboursé.`,
      );
    items.push({ orderItemId: line.id, quantity: item.quantity });
  }
  if (!items.length)
    throw new ReturnError('Choisissez au moins un article à retourner.');
  const request = await tx.returnRequest.create({
    data: {
      number: returnNumber(),
      orderId: order.id,
      reason: input.reason,
      source: by ? 'ADMIN' : 'CUSTOMER',
      customerMessage: input.message || null,
      createdById: by?.adminId ?? null,
      items: { create: items },
      ...(input.photos?.length
        ? {
            photos: {
              create: input.photos.map((filename) => ({
                filename,
                source: by ? ('ADMIN' as const) : ('CUSTOMER' as const),
              })),
            },
          }
        : {}),
    },
    include: withItems,
  });
  // Declared by the customer: the shop has to answer.
  if (!by)
    await notifyShop(tx, order.id, {
      type: 'SHOP_RETURN_REQUESTED',
      returnId: request.id,
    });
  if (!by || by.notify)
    await enqueueOrderEmail(
      tx,
      order.id,
      'RETURN_REQUESTED',
      emailInput(request),
    );
  if (by)
    await audit(tx, by.adminId, 'RETURN_CREATED', 'Order', order.id, {
      returnId: request.id,
      number: request.number,
      reason: request.reason,
    });
  return request;
}

/** Declared by the customer from the order page or the withdrawal form. */
export function requestReturn(input: NewReturn) {
  return transaction((tx) => createReturnIn(tx, input, null));
}

/** Recorded by the shop; the customer is e-mailed only if asked. */
export async function createAdminReturn(
  adminId: string,
  input: NewReturn,
  notify: boolean,
) {
  try {
    return await adminTransaction(adminId, (tx) =>
      createReturnIn(tx, input, { adminId, notify }),
    );
  } catch (error) {
    if (error instanceof ReturnError) throw new AdminError(error.message);
    throw error;
  }
}

/**
 * The whole order at once, from the public withdrawal form: order number and
 * e-mail identify it; the acknowledgment goes to the order's address.
 */
export async function requestWithdrawal(
  orderNumber: string,
  email: string,
  message: string,
) {
  const order = await getPrisma().order.findFirst({
    where: {
      orderNumber,
      email: { equals: email, mode: 'insensitive' },
      status: 'PAID',
    },
    select: { id: true },
  });
  if (!order)
    throw new ReturnError(
      'Aucune commande payée ne correspond à ce numéro et à cette adresse e-mail.',
    );
  return transaction(async (tx) => {
    const { lines } = await returnableLines(tx, order.id);
    const items = lines
      .filter((line) => line.left > 0)
      .map((line) => ({ orderItemId: line.id, quantity: line.left }));
    if (!items.length)
      throw new ReturnError(
        'Tous les articles de cette commande sont déjà retournés ou remboursés.',
      );
    return createReturnIn(
      tx,
      { orderId: order.id, reason: 'WITHDRAWAL', items, message },
      null,
    );
  });
}

async function move(
  adminId: string,
  returnId: string,
  to: ReturnStatus,
  data: Prisma.ReturnRequestUpdateInput,
  email?: 'RETURN_APPROVED' | 'RETURN_REJECTED' | 'RETURN_RECEIVED',
) {
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id = ${returnId}::uuid FOR UPDATE`;
    const current = await tx.returnRequest.findUnique({
      where: { id: returnId },
    });
    if (!current) throw new AdminError('Retour introuvable.');
    if (!canMoveReturn(current.status, to))
      throw new AdminError(
        'Ce retour a changé d’état entre-temps. Rechargez la page.',
      );
    const updated = await tx.returnRequest.update({
      where: { id: returnId },
      data: { ...data, status: to },
      include: withItems,
    });
    if (email)
      await enqueueOrderEmail(tx, updated.orderId, email, emailInput(updated));
    await audit(tx, adminId, `RETURN_${to}`, 'Order', updated.orderId, {
      returnId,
      number: updated.number,
    });
    return updated;
  });
}

export function approveReturn(
  adminId: string,
  returnId: string,
  resolution: string,
) {
  return move(
    adminId,
    returnId,
    'APPROVED',
    { approvedAt: new Date(), resolution: resolution || null },
    'RETURN_APPROVED',
  );
}

export async function rejectReturn(
  adminId: string,
  returnId: string,
  resolution: string,
) {
  if (!resolution)
    throw new AdminError('Expliquez au client pourquoi le retour est refusé.');
  return await move(
    adminId,
    returnId,
    'REJECTED',
    { closedAt: new Date(), resolution },
    'RETURN_REJECTED',
  );
}

/** The parcel is back; the customer is told unless the shop opts out. */
export function receiveReturn(
  adminId: string,
  returnId: string,
  notify = true,
) {
  return move(
    adminId,
    returnId,
    'RECEIVED',
    { receivedAt: new Date() },
    notify ? 'RETURN_RECEIVED' : undefined,
  );
}

/**
 * Settles a return with new items instead of money: the returned units leave
 * the stock, a parcel is recorded against the return (never the order's own
 * shipment) and the customer gets its tracking. The faulty item need not be
 * back first: the shop decides.
 */
export async function replaceReturn(
  adminId: string,
  returnId: string,
  input: {
    shipment: {
      carrierCode: string;
      carrierName: string;
      hasTracking: boolean;
      trackingNumber: string | null;
      trackingUrl: string | null;
    };
    message: string;
  },
) {
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id = ${returnId}::uuid FOR UPDATE`;
    const current = await tx.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        items: {
          include: {
            orderItem: { select: { productName: true, variantId: true } },
          },
        },
        refund: { select: { status: true } },
        order: { select: { status: true } },
      },
    });
    if (!current) throw new AdminError('Retour introuvable.');
    if (!canMoveReturn(current.status, 'REPLACED'))
      throw new AdminError(
        'Ce retour a changé d’état entre-temps. Rechargez la page.',
      );
    if (current.order.status !== 'PAID')
      throw new AdminError('Seule une commande payée peut être remplacée.');
    if (
      current.refund &&
      ['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED'].includes(
        current.refund.status,
      )
    )
      throw new AdminError(
        'Un remboursement est déjà engagé pour ce retour : il ne peut plus être remplacé.',
      );
    const variantIds: string[] = [];
    for (const item of current.items) {
      const name = item.orderItem.productName;
      const variantId = item.orderItem.variantId;
      if (!variantId)
        throw new AdminError(
          `« ${name} » n’est plus au catalogue : remboursez plutôt ce retour.`,
        );
      const { availableQuantity } = await tx.productVariant.findUniqueOrThrow({
        where: { id: variantId },
        select: { availableQuantity: true },
      });
      if (availableQuantity < item.quantity)
        throw new AdminError(
          `Stock insuffisant pour « ${name} » : ${availableQuantity} disponible${availableQuantity > 1 ? 's' : ''}, ${item.quantity} à envoyer. Réapprovisionnez ou remboursez.`,
        );
      await changeStock(tx, adminId, variantId, {
        quantity: -item.quantity,
        mode: 'delta',
        type: 'REPLACEMENT',
        reason: `Remplacement ${current.number}`,
      });
      variantIds.push(variantId);
    }
    const now = new Date();
    await tx.shipment.create({
      data: {
        orderId: current.orderId,
        returnId,
        isPrimary: false,
        status: 'SHIPPED',
        shippedAt: now,
        ...input.shipment,
      },
    });
    const updated = await tx.returnRequest.update({
      where: { id: returnId },
      data: {
        status: 'REPLACED',
        closedAt: now,
        resolution: input.message || current.resolution,
      },
      include: withItems,
    });
    await enqueueOrderEmail(tx, updated.orderId, 'RETURN_REPLACED', {
      ...emailInput(updated),
      // This e-mail carries this message only, not the earlier answer.
      resolution: input.message || null,
      replacement: {
        carrier: input.shipment.carrierName,
        trackingNumber: input.shipment.trackingNumber,
        trackingUrl: input.shipment.trackingUrl,
      },
    });
    await audit(tx, adminId, 'RETURN_REPLACED', 'Order', updated.orderId, {
      returnId,
      number: updated.number,
      carrier: input.shipment.carrierName,
      trackingNumber: input.shipment.trackingNumber,
    });
    return { ...updated, variantIds };
  });
}

/** Photos the customer sent by e-mail, added by the shop to the file. */
export async function addReturnPhotos(
  adminId: string,
  returnId: string,
  filenames: readonly string[],
) {
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id = ${returnId}::uuid FOR UPDATE`;
    const current = await tx.returnRequest.findUnique({
      where: { id: returnId },
      select: {
        orderId: true,
        number: true,
        _count: { select: { photos: true } },
      },
    });
    if (!current) throw new AdminError('Retour introuvable.');
    if (current._count.photos + filenames.length > MAX_RETURN_PHOTOS)
      throw new AdminError(
        `${MAX_RETURN_PHOTOS} photos au plus par retour (${current._count.photos} déjà jointe${current._count.photos > 1 ? 's' : ''}).`,
      );
    await tx.returnPhoto.createMany({
      data: filenames.map((filename) => ({
        returnId,
        filename,
        source: 'ADMIN' as const,
      })),
    });
    await audit(tx, adminId, 'RETURN_PHOTOS_ADDED', 'Order', current.orderId, {
      returnId,
      number: current.number,
      count: filenames.length,
    });
    return current;
  });
}

export function cancelReturn(adminId: string, returnId: string) {
  return move(adminId, returnId, 'CANCELED', { closedAt: new Date() });
}

export async function saveReturnNote(
  adminId: string,
  returnId: string,
  note: string,
) {
  await adminTransaction(adminId, (tx) =>
    tx.returnRequest.update({
      where: { id: returnId },
      data: { internalNote: note || null },
    }),
  );
}

/**
 * Refunds the returned items through the refund service (Stripe, order lock,
 * idempotency); the return is closed once Stripe confirms.
 */
export async function refundReturn(
  adminId: string,
  input: {
    returnId: string;
    idempotencyKey: string;
    includeShipping: boolean;
    amountCents: number | null;
    restock: boolean;
    note: string;
  },
  gateway?: RefundGateway,
) {
  const request = await getPrisma().returnRequest.findUnique({
    where: { id: input.returnId },
    include: { items: true },
  });
  if (!request) throw new AdminError('Retour introuvable.');
  return requestRefund(
    adminId,
    {
      orderId: request.orderId,
      idempotencyKey: input.idempotencyKey,
      lines: request.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
      includeShipping: input.includeShipping,
      amountCents: input.amountCents,
      reason: refundReasonForReturn(request.reason),
      note: input.note || `Retour ${request.number}`,
      restock: input.restock,
      returnId: request.id,
    },
    gateway,
  );
}
