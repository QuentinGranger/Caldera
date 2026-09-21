import 'server-only';
import { appOrigin } from '@/lib/orders/access';
import { getPrisma } from '@/lib/db/prisma';

export function customerTokenUrl(path: string, token: string) {
  return `${appOrigin()}${path}?token=${encodeURIComponent(token)}`;
}

export async function queueCustomerVerification(
  customerId: string,
  token: string,
) {
  const customer = await getPrisma().customer.findUnique({
    where: { id: customerId },
    select: { email: true },
  });
  if (!customer) return;
  await enqueueCustomerEmail(
    customerId,
    'EMAIL_VERIFICATION',
    customer.email,
    'Confirmez votre adresse email',
    'Bienvenue dans Caldera',
    'Confirmez votre adresse email pour sécuriser votre compte.',
    customerTokenUrl('/connexion/verification', token),
  );
}

export async function queueCustomerPasswordReset(
  customerId: string,
  token: string,
) {
  const customer = await getPrisma().customer.findUnique({
    where: { id: customerId },
    select: { email: true },
  });
  if (!customer) return;
  await enqueueCustomerEmail(
    customerId,
    'PASSWORD_RESET',
    customer.email,
    'Réinitialisation de votre mot de passe',
    'Réinitialiser votre mot de passe',
    'Ce lien est valable pendant une heure.',
    customerTokenUrl('/reinitialiser-mot-de-passe', token),
  );
}

export async function queueCustomerEmailChange(
  customerId: string,
  token: string,
  recipient: string,
) {
  await enqueueCustomerEmail(
    customerId,
    'EMAIL_CHANGE',
    recipient,
    'Confirmez votre nouvelle adresse email',
    'Confirmer votre adresse',
    'Validez cette nouvelle adresse pour votre compte Caldera.',
    customerTokenUrl('/connexion/verification-email', token),
  );
}

async function enqueueCustomerEmail(
  customerId: string,
  type: 'EMAIL_VERIFICATION' | 'EMAIL_CHANGE' | 'PASSWORD_RESET',
  recipient: string,
  subject: string,
  title: string,
  text: string,
  href: string,
) {
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:32px;background:#f6f1e4;color:#173e32;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:32px;background:#fffcf5;border-top:4px solid #e8c261"><p style="color:#003c2d;font-weight:bold;letter-spacing:.12em">LES TERRES DE CALDERA</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 20px;background:#003c2d;color:#fff;text-decoration:none">Continuer</a></p><p style="font-size:12px;color:#60665d">Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.</p></main></body></html>`;
  await getPrisma().$transaction(async (tx) => {
    await tx.customerEmailDelivery.deleteMany({
      where: { customerId, type, status: { in: ['PENDING', 'FAILED'] } },
    });
    await tx.customerEmailDelivery.create({
      data: {
        customerId,
        type,
        recipient,
        subject,
        html,
        text: `${title}\n\n${text}\n\n${href}`,
      },
    });
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );
}
