import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import {
  emailSettings,
  EmailProviderError,
  resendProvider,
} from '@/lib/email/provider';
import { PRODUCTION_SITE_URL } from '@/lib/site';

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

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      (
        {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        } as const
      )[character as '&' | '<' | '>' | '"' | "'"]!,
  );
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
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 20_000) {
    return NextResponse.json(
      { message: 'Le message envoyé est trop volumineux.' },
      { status: 413 },
    );
  }

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
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('invalid');
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { message: 'Le formulaire envoyé est invalide.' },
      { status: 400 },
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
    message.length < 10
  ) {
    return NextResponse.json(
      { message: 'Vérifiez les champs du formulaire avant de l’envoyer.' },
      { status: 400 },
    );
  }

  if (process.env.EMAILS_ENABLED !== 'true') return configurationError();

  const contactRecipient = process.env.CONTACT_EMAIL_TO?.trim() ?? '';
  if (!emailPattern.test(contactRecipient)) return configurationError();

  try {
    const settings = emailSettings();
    const provider = resendProvider();
    const recipient = settings.testRecipient ?? contactRecipient;
    const subject =
      (settings.testRecipient ? '[TEST] ' : '') +
      '[Contact] ' +
      topics[topic];
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeOrder = escapeHtml(orderNumber);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    await provider.send(
      {
        from: settings.from,
        to: [recipient],
        reply_to: email,
        subject,
        html:
          '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' +
          escapeHtml(subject) +
          '</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#173e32">' +
          '<h1 style="font-family:Georgia,serif">Nouveau message depuis Les Terres de Caldera</h1>' +
          '<p><strong>Nom :</strong> ' +
          safeName +
          '<br><strong>E-mail :</strong> ' +
          safeEmail +
          '<br><strong>Sujet :</strong> ' +
          escapeHtml(topics[topic]) +
          (safeOrder
            ? '<br><strong>Commande :</strong> ' + safeOrder
            : '') +
          '</p><hr><p>' +
          safeMessage +
          '</p><hr><p style="font-size:12px;color:#60665d">Message envoyé depuis <a href="' +
          PRODUCTION_SITE_URL +
          '">lesterresdecaldera.fr</a>.</p></body></html>',
        text: [
          'Nouveau message depuis Les Terres de Caldera',
          'Nom : ' + name,
          'E-mail : ' + email,
          'Sujet : ' + topics[topic],
          ...(orderNumber ? ['Commande : ' + orderNumber] : []),
          '',
          message,
          '',
          'Site : ' + PRODUCTION_SITE_URL,
        ].join('\n'),
      },
      'caldera-contact:' + randomUUID(),
    );

    return NextResponse.json({
      message: 'Votre message a bien été envoyé.',
    });
  } catch (error) {
    console.error('Contact email unavailable', {
      code:
        error instanceof EmailProviderError
          ? error.code
          : 'CONTACT_EMAIL_UNAVAILABLE',
    });
    return configurationError();
  }
}
