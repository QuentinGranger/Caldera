import 'server-only';
import { cancelOrder } from '@/lib/payments/cancel';
import { adminTransaction, audit } from './common';
import { AdminError, id, text, whitelist } from './validation';
export async function saveOrderNote(adminId: string, form: FormData) {
  whitelist(form, ['id', 'internalNote', 'version']);
  const orderId = id(form)!;
  const internalNote = text(form, 'internalNote', 5000, false);
  return adminTransaction(adminId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { updatedAt: true },
    });
    if (order.updatedAt.toISOString() !== text(form, 'version'))
      throw new AdminError(
        'La commande a changé. Rechargez avant d’enregistrer.',
      );
    await tx.order.update({
      where: { id: orderId },
      data: { internalNote: internalNote || null },
    });
    await audit(tx, adminId, 'ORDER_NOTE_UPDATED', 'Order', orderId, {
      length: internalNote.length,
    });
    return orderId;
  });
}
export async function cancelAdminOrder(adminId: string, form: FormData) {
  whitelist(form, ['id']);
  const orderId = id(form)!;
  await adminTransaction(adminId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_FAILED')
      throw new AdminError(
        'Cette commande ne peut pas être annulée depuis l’administration.',
      );
    await audit(tx, adminId, 'ORDER_CANCELLATION_REQUESTED', 'Order', orderId, {
      previous: order.status,
    });
  });
  // Existing service confirms the Stripe state before releasing any reservations.
  await cancelOrder(orderId);
  const status = await adminTransaction(adminId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    await audit(tx, adminId, 'ORDER_CANCELLATION_RESULT', 'Order', orderId, {
      next: order.status,
    });
    return order.status;
  });
  if (status !== 'CANCELLED')
    throw new AdminError(
      'Le paiement a évolué : annulation non effectuée. Rechargez la commande.',
    );
  return orderId;
}
