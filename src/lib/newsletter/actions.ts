'use server';
import { revalidatePath } from 'next/cache';
import { accountEmail } from '@/lib/account/validation';
import { allowAccountAttempt } from '@/lib/account/limits';
import { getPrisma } from '@/lib/db/prisma';
import { sendNewsletterConfirmation } from './email';
import {
  newNewsletterConfirmationToken,
  newsletterTokenHash,
  verifyNewsletterUnsubscribeToken,
} from './tokens';
import {
  NEWSLETTER_CONSENT_VERSION,
  type NewsletterActionState,
} from './validation';

const GENERIC_SUCCESS =
  'Vérifiez votre boîte mail : si l’adresse peut être inscrite, un lien de confirmation valable 24 heures vient d’être envoyé.';
const UNAVAILABLE =
  'L’inscription est momentanément indisponible. Réessayez dans quelques minutes.';

function failure(
  message: string,
  errors?: Record<string, string>,
): NewsletterActionState {
  return { success: false, message, ...(errors ? { errors } : {}) };
}

function logUnexpected(action: string) {
  console.error(
    JSON.stringify({ scope: 'newsletter', action, code: 'UNEXPECTED' }),
  );
}

export async function subscribeNewsletterAction(
  _previous: NewsletterActionState,
  form: FormData,
): Promise<NewsletterActionState> {
  // A hidden field catches simple bots without storing or contacting them.
  if (form.get('website')) return { success: true, message: GENERIC_SUCCESS };
  const email = accountEmail(form.get('email'));
  const consent = form.get('consent') === 'on';
  const errors: Record<string, string> = {};
  if (!email) errors.email = 'Indiquez une adresse e-mail valide.';
  if (!consent)
    errors.consent = 'Cochez la case pour consentir à recevoir la newsletter.';
  if (!email || !consent)
    return failure('Vérifiez les champs indiqués.', errors);

  try {
    if (!(await allowAccountAttempt('newsletter', email)))
      return { success: true, message: GENERIC_SUCCESS };
    const db = getPrisma();
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
    });
    const now = new Date();
    if (existing?.status === 'ACTIVE') {
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          consentAt: now,
          consentSource: 'homepage',
          consentVersion: NEWSLETTER_CONSENT_VERSION,
          lastInterestAt: now,
        },
      });
      return { success: true, message: GENERIC_SUCCESS };
    }
    const token = newNewsletterConfirmationToken();
    const data = {
      status: 'PENDING' as const,
      consentAt: now,
      consentSource: 'homepage',
      consentVersion: NEWSLETTER_CONSENT_VERSION,
      confirmationTokenHash: newsletterTokenHash(token),
      confirmationExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      confirmedAt: null,
      unsubscribedAt: null,
      lastInterestAt: now,
    };
    if (existing)
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data,
      });
    else await db.newsletterSubscriber.create({ data: { email, ...data } });
    await sendNewsletterConfirmation(email, token);
    revalidatePath('/admin/newsletter');
    return { success: true, message: GENERIC_SUCCESS };
  } catch {
    logUnexpected('subscribe_failed');
    return failure(UNAVAILABLE);
  }
}

export async function confirmNewsletterAction(
  _previous: NewsletterActionState,
  form: FormData,
): Promise<NewsletterActionState> {
  const token = form.get('token');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(token))
    return failure('Ce lien de confirmation n’est pas valable.');
  try {
    const result = await getPrisma().newsletterSubscriber.updateMany({
      where: {
        confirmationTokenHash: newsletterTokenHash(token),
        status: 'PENDING',
        confirmationExpiresAt: { gt: new Date() },
      },
      data: {
        status: 'ACTIVE',
        confirmedAt: new Date(),
        lastInterestAt: new Date(),
        confirmationTokenHash: null,
        confirmationExpiresAt: null,
      },
    });
    if (result.count !== 1)
      return failure(
        'Ce lien a expiré ou a déjà servi. Vous pouvez vous réinscrire depuis la page d’accueil.',
      );
    revalidatePath('/admin/newsletter');
    return {
      success: true,
      message: 'Votre inscription est confirmée. Bienvenue dans l’expédition !',
    };
  } catch {
    logUnexpected('confirm_failed');
    return failure(UNAVAILABLE);
  }
}

export async function unsubscribeNewsletterAction(
  _previous: NewsletterActionState,
  form: FormData,
): Promise<NewsletterActionState> {
  const id = verifyNewsletterUnsubscribeToken(form.get('token'));
  if (!id) return failure('Ce lien de désinscription n’est pas valable.');
  try {
    await getPrisma().newsletterSubscriber.updateMany({
      where: { id },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
        confirmationTokenHash: null,
        confirmationExpiresAt: null,
      },
    });
    revalidatePath('/admin/newsletter');
    return {
      success: true,
      message:
        'Votre désinscription est enregistrée. Vous ne recevrez plus la newsletter.',
    };
  } catch {
    logUnexpected('unsubscribe_failed');
    return failure(UNAVAILABLE);
  }
}
