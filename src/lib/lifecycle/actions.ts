'use server';
import {
  clearSubscriberEngagement,
  EMAIL_TRACKING_VERSION,
  trackingAllowed,
} from '@/lib/email/engagement';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCustomer } from '@/lib/account/guard';
import { allowAccountAttempt } from '@/lib/account/limits';
import { getPrisma } from '@/lib/db/prisma';
import type { AccountActionState } from '@/lib/account/validation';
import { getCartCookie, setCartCookie } from '@/lib/cart/cartCookie';
import { cartTokenHash } from '@/lib/cart/identity';
import { mutateCart } from '@/lib/cart/service';
import { availableVariants } from './catalog';
import { verifyRecoveryToken } from './tokens';
import { currentLifecycleContent } from './processor';
export async function saveCommunicationsAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const customer = await requireCustomer('/compte/profil');
  if (!customer.emailVerified)
    return {
      success: false,
      message:
        'Confirmez votre adresse e-mail avant de modifier ces préférences.',
    };
  const active = await getPrisma().newsletterSubscriber.findUnique({
    where: { email: customer.email },
  });
  if (active?.status !== 'ACTIVE')
    return {
      success: false,
      message:
        'Inscrivez-vous et confirmez d’abord la newsletter pour activer les communications commerciales.',
    };
  const enabled = form.get('personalized') === 'on';
  const tracking = form.get('emailTracking') === 'on';
  const consentAt =
    tracking && trackingAllowed(active)
      ? active.emailTrackingConsentAt
      : tracking
        ? new Date()
        : null;
  await getPrisma().newsletterSubscriber.update({
    where: { id: active.id },
    data: {
      personalizedEmails: enabled,
      emailTracking: tracking,
      emailTrackingConsentAt: consentAt,
      emailTrackingConsentVersion: tracking ? EMAIL_TRACKING_VERSION : null,
      personalizedConsentAt: enabled ? new Date() : null,
      personalizedConsentVersion: enabled ? '2026-10-11-v1' : null,
    },
  });
  if (!tracking) await clearSubscriberEngagement(active.id);
  if (!enabled)
    await getPrisma().lifecycleDelivery.updateMany({
      where: {
        subscriberId: active.id,
        status: 'PENDING',
        kind: { notIn: ['WELCOME', 'NEW_ARRIVAL'] },
      },
      data: { status: 'SKIPPED', lastError: 'CONSENTEMENT_RETIRE' },
    });
  revalidatePath('/compte/profil');
  return {
    success: true,
    message: 'Vos préférences d’e-mail sont enregistrées.',
  };
}
export async function restoreSelectionAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  if (process.env.CATALOG_DEMO_MODE === '1')
    return { success: false, message: 'Les achats ne sont pas ouverts.' };
  const id = verifyRecoveryToken(form.get('token'));
  if (!id || !(await allowAccountAttempt('cart-recovery', id)))
    return {
      success: false,
      message:
        'Ce lien a expiré ou est indisponible. Retrouvez les produits dans le catalogue.',
    };
  const db = getPrisma();
  const row = await db.lifecycleDelivery.findUnique({
    where: { id },
    include: { subscriber: true },
  });
  if (!row || !row.kind.startsWith('CART_') || row.expiresAt <= new Date())
    return {
      success: false,
      message: 'Cette sélection n’est plus disponible.',
    };
  const content = await currentLifecycleContent(row, row.subscriber.email);
  if (!content)
    return {
      success: false,
      message:
        'Cette sélection a évolué ou a déjà été commandée. Consultez le catalogue.',
    };
  const token = await getCartCookie();
  const hash = cartTokenHash(token);
  const current = hash
    ? await db.cart.findUnique({
        where: { tokenHash: hash },
        include: { items: true },
      })
    : null;
  // Never replace or silently merge a visitor’s current selection.
  if (
    current?.status === 'ACTIVE' &&
    current.expiresAt > new Date() &&
    current.items.length
  )
    return {
      success: false,
      message:
        'Votre panier contient déjà des articles. Retrouvez-le depuis le menu ; aucun article n’a été remplacé.',
    };
  let restored: string | undefined;
  try {
    for (const variant of await availableVariants(row.variantIds))
      restored = await mutateCart(restored, {
        kind: 'add',
        variantId: variant.id,
        quantity: Math.min(
          variant.availableQuantity,
          row.quantities[row.variantIds.indexOf(variant.id)] ?? 1,
        ),
      });
    if (!restored)
      return {
        success: false,
        message: 'Aucun article disponible à reprendre.',
      };
    await setCartCookie(restored);
  } catch {
    return {
      success: false,
      message:
        'Le prix ou le stock a évolué. Consultez les fiches pour refaire votre sélection.',
    };
  }
  // Carry only the public campaign through the recovery redirect, never its token.
  redirect(
    `/panier?utm_source=newsletter&utm_medium=email&utm_campaign=${encodeURIComponent(`lifecycle_${row.kind.toLowerCase()}`)}`,
  );
}
