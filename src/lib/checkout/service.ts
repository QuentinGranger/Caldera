import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { cartTokenHash } from '@/lib/cart/identity';
import { readCheckout } from './queries';
import { getCheckoutSummary, validateCheckout } from './validation';
import { CheckoutError, parseContact, parseId } from './schemas';

const CHECKOUT_LIFETIME_MS = 24 * 60 * 60 * 1000;
type Mutation =
  | { kind: 'start' | 'sync' }
  | { kind: 'contact'; sessionId: unknown; contact: unknown }
  | { kind: 'shipping'; sessionId: unknown; methodId: unknown }
  | { kind: 'prepare'; sessionId: unknown };
export async function mutateCheckout(
  token: string | undefined,
  mutation: Mutation,
) {
  const hash = cartTokenHash(token);
  if (!hash) throw new CheckoutError('Votre panier est introuvable.');
  const sessionId =
    'sessionId' in mutation ? parseId(mutation.sessionId) : null;
  const methodId =
    mutation.kind === 'shipping' ? parseId(mutation.methodId) : null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await getPrisma().$transaction(
        async (tx) => {
          // Cart mutations acquire this same row first: no lost cart/checkout updates.
          const locked = await tx.cart.updateMany({
            where: {
              tokenHash: hash,
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
            data: { updatedAt: new Date() },
          });
          if (!locked.count)
            throw new CheckoutError(
              'Votre panier a expiré ou est introuvable.',
            );
          const data = await readCheckout(tx, token);
          if (!data)
            throw new CheckoutError(
              'Ajoutez un article au panier avant de poursuivre.',
            );
          const paymentOrder = await tx.order.findFirst({
            where: {
              checkoutSession: { cartId: data.cart.id },
              status: {
                in: [
                  'PENDING_PAYMENT',
                  'PAYMENT_FAILED',
                  'PAYMENT_PROCESSING',
                  'PAYMENT_REVIEW',
                ],
              },
            },
            select: { id: true },
          });
          if (paymentOrder) {
            if (mutation.kind === 'sync' || mutation.kind === 'start')
              return 'review' as const;
            throw new CheckoutError(
              'Un paiement est en cours. Annulez cette tentative avant de modifier le checkout.',
            );
          }
          let { session } = data;
          const view = getCheckoutSummary(data);
          const expired = view.status === 'EXPIRED';
          if (
            sessionId &&
            (session?.id !== sessionId || session.cartId !== data.cart.id)
          )
            throw new CheckoutError(
              'Cette session n’appartient pas à votre panier courant.',
            );
          if (mutation.kind === 'sync') {
            if (session && expired)
              await tx.checkoutSession.update({
                where: { id: session.id },
                data: { status: 'EXPIRED', readyFingerprint: null },
              });
            else if (session)
              await tx.checkoutSession.update({
                where: { id: session.id },
                data: {
                  status:
                    view.status === 'READY_FOR_PAYMENT'
                      ? 'READY_FOR_PAYMENT'
                      : 'IN_PROGRESS',
                  readyFingerprint:
                    view.status === 'READY_FOR_PAYMENT'
                      ? session.readyFingerprint
                      : null,
                  shippingMethodId: view.selectedMethod?.id ?? null,
                  shippingAmount: view.shippingAmount,
                },
              });
            return view.requiredStep;
          }
          if (view.blocked)
            throw new CheckoutError(
              'Votre panier doit être mis à jour avant de poursuivre.',
            );
          if (mutation.kind === 'start') {
            if (session && expired)
              await tx.checkoutSession.update({
                where: { id: session.id },
                data: { status: 'EXPIRED', readyFingerprint: null },
              });
            if (!session || expired)
              session = await tx.checkoutSession.create({
                data: {
                  cartId: data.cart.id,
                  expiresAt: new Date(Date.now() + CHECKOUT_LIFETIME_MS),
                },
                include: { addresses: true },
              });
            return !data.session || expired
              ? ('contact' as const)
              : view.requiredStep;
          }
          if (!session || expired)
            throw new CheckoutError(
              'Votre session a expiré. Recommencez depuis votre panier.',
            );
          if (mutation.kind === 'contact') {
            const contact = parseContact(
              mutation.contact,
              data.countries.map((country) => country.code),
            );
            await tx.checkoutSession.update({
              where: { id: session.id },
              data: {
                email: contact.email,
                phone: contact.phone || null,
                billingSame: contact.billingSame,
                status: 'IN_PROGRESS',
                readyFingerprint: null,
                shippingMethodId: null,
                shippingAmount: null,
              },
            });
            for (const role of ['SHIPPING', 'BILLING'] as const) {
              const address =
                role === 'SHIPPING' ? contact.shipping : contact.billing;
              if (!address)
                await tx.checkoutAddress.deleteMany({
                  where: { checkoutId: session.id, role },
                });
              else
                await tx.checkoutAddress.upsert({
                  where: { checkoutId_role: { checkoutId: session.id, role } },
                  create: { checkoutId: session.id, role, ...address },
                  update: address,
                });
            }
            return 'shipping' as const;
          }
          if (mutation.kind === 'shipping') {
            if (view.requiredStep === 'contact')
              throw new CheckoutError(
                'Complétez vos coordonnées avant de choisir une livraison.',
              );
            const method = view.methods.find((m) => m.id === methodId);
            if (!method)
              throw new CheckoutError(
                'Ce mode de livraison n’est plus disponible pour votre destination.',
              );
            await tx.checkoutSession.update({
              where: { id: session.id },
              data: {
                shippingMethodId: method.id,
                shippingAmount: method.amount,
                status: 'IN_PROGRESS',
                readyFingerprint: null,
              },
            });
            return 'review' as const;
          }
          const { view: validated, fingerprint } = validateCheckout(data);
          await tx.checkoutSession.update({
            where: { id: session.id },
            data: {
              status: 'READY_FOR_PAYMENT',
              readyFingerprint: fingerprint,
              shippingAmount: validated.shippingAmount,
            },
          });
          return 'review' as const;
        },
        { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 3
      )
        continue;
      throw error;
    }
  }
  throw new CheckoutError('La session est occupée. Réessayez.');
}
