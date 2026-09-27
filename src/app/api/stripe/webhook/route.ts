import { after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CATALOG_CACHE_TAG } from '@/lib/seo/registry';
import { safelyProcessEmails } from '@/lib/email/processor';
import { getStripe, stripeMode } from '@/lib/stripe/stripe';
import { verifyWebhook } from '@/lib/stripe/webhook';
import { paymentEvents, processPaymentEvent } from '@/lib/payments/events';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: 'Webhook indisponible' }, { status: 503 });
  let event;
  try {
    event = verifyWebhook(
      await request.text(),
      request.headers.get('stripe-signature') ?? '',
      secret,
    );
  } catch {
    console.error(
      JSON.stringify({
        scope: 'payments',
        action: 'webhook_signature_invalid',
      }),
    );
    return Response.json({ error: 'Signature invalide' }, { status: 400 });
  }
  if (event.livemode !== (stripeMode() === 'live'))
    return Response.json({ error: 'Mode non pris en charge' }, { status: 400 });
  if (!paymentEvents.has(event.type)) return Response.json({ received: true });
  try {
    // Re-read Stripe: old/delayed events cannot force an obsolete state transition.
    const object = event.data.object;
    if (object.object !== 'payment_intent')
      return Response.json({ error: 'Événement invalide' }, { status: 400 });
    const intent = await getStripe().paymentIntents.retrieve(object.id);
    await processPaymentEvent(event.id, event.type, intent);
    // Stock just changed (consumed or released): stock texts must not lag.
    revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
    after(async () => {
      await safelyProcessEmails();
    });
    return Response.json({ received: true });
  } catch {
    console.error(
      JSON.stringify({
        scope: 'payments',
        action: 'webhook_retry_needed',
        eventId: event.id,
      }),
    );
    return Response.json({ error: 'Traitement à réessayer' }, { status: 500 });
  }
}
