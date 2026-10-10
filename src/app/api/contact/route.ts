import { NextResponse } from 'next/server';

import {
  emailSettings,
  EmailProviderError,
  resendProvider,
} from '@/lib/email/provider';
import { contactRetryAfter } from '@/lib/contact/limits';
import { getPrisma } from '@/lib/db/prisma';
import { ContactRequestError, readContactBody } from '@/lib/contact/request';
import { PRODUCTION_SITE_URL } from '@/lib/site';
import { appOrigin } from '@/lib/orders/access';
import { renderContactEmail } from '@/emails/contact';
import { preordersEnabled } from '@/lib/catalog/preorders';

export const runtime = 'nodejs';

const topics = {
  commande: 'Commande',
  produit: 'Produit ou stock',
  precommande: 'Précommande',
  livraison: 'Livraison',
  autre: 'Autre demande',
} as const;

type Topic = keyof typeof topics;

const emailPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function configurationError() {
  return NextResponse.json(
    {
      message:
        'Le formulaire de contact est momentanément indisponible. Réessayez plus tard.',
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json(
          { message: 'Origine de la requête refusée.' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: 'Origine de la requête invalide.' },
        { status: 403 },
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await readContactBody(request);
  } catch (error) {
    if (error instanceof ContactRequestError && error.status === 413)
      return NextResponse.json(
        { message: 'Le message envoyé est trop volumineux.' },
        { status: 413 },
      );
    return NextResponse.json(
      { message: 'Le formulaire envoyé est invalide.' },
      { status: error instanceof ContactRequestError ? error.status : 400 },
    );
  }

  if (text(body.website, 200)) {
    return NextResponse.json({
      message: 'Votre message a bien été envoyé.',
    });
  }

  const name = text(body.name, 80);
  const email = text(body.email, 254).toLowerCase();
  const topic = text(body.topic, 30) as Topic;
  const orderNumber = text(body.orderNumber, 50);
  const message = text(body.message, 5000);

  if (
    name.length < 2 ||
    !emailPattern.test(email) ||
    !Object.hasOwn(topics, topic) ||
    (topic === 'precommande' && !preordersEnabled()) ||
    message.length < 10
  ) {
    return NextResponse.json(
      { message: 'Vérifiez les champs du formulaire avant de l’envoyer.' },
      { status: 400 },
    );
  }

  try {
    const retryAfter = await contactRetryAfter(email);
    if (retryAfter !== null) {
      return NextResponse.json(
        { message: 'Trop de messages envoyés. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
    // Kept first: an e-mail that fails never loses the message, which waits
    // in the administration (/admin/messages).
    const saved = await getPrisma().contactMessage.create({
      data: {
        name,
        email,
        topic: topics[topic],
        orderNumber: orderNumber || null,
        message,
      },
      select: { id: true },
    });
    if (await emailShop(saved.id, { name, email, topic, orderNumber, message }))
      await getPrisma().contactMessage.update({
        where: { id: saved.id },
        data: { emailedAt: new Date() },
      });
    return NextResponse.json({
      message: 'Votre message a bien été envoyé.',
    });
  } catch {
    console.error('Contact message unavailable', {
      code: 'CONTACT_MESSAGE_UNAVAILABLE',
    });
    return configurationError();
  }
}

/** The shop's copy by e-mail; false when e-mails are off or failing. */
async function emailShop(
  id: string,
  contact: {
    name: string;
    email: string;
    topic: Topic;
    orderNumber: string;
    message: string;
  },
) {
  const contactRecipient = process.env.CONTACT_EMAIL_TO?.trim() ?? '';
  if (
    process.env.EMAILS_ENABLED !== 'true' ||
    !emailPattern.test(contactRecipient)
  )
    return false;
  try {
    const settings = emailSettings();
    const provider = resendProvider();
    const recipient = settings.testRecipient ?? contactRecipient;
    const rendered = renderContactEmail(
      { ...contact, topic: topics[contact.topic] },
      {
        admin: appOrigin(),
        logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
        site: PRODUCTION_SITE_URL,
      },
    );
    await provider.send(
      {
        from: settings.from,
        to: [recipient],
        // « Répondre » answers the customer directly.
        reply_to: contact.email,
        subject: (settings.testRecipient ? '[TEST] ' : '') + rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      `caldera-contact:${id}`,
    );
    return true;
  } catch (error) {
    console.error('Contact email unavailable', {
      code:
        error instanceof EmailProviderError
          ? error.code
          : 'CONTACT_EMAIL_UNAVAILABLE',
    });
    return false;
  }
}
