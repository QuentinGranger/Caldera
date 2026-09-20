import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { serializeCart } from '@/lib/cart/queries';
import { MAX_CART_ITEM_QUANTITY } from '@/lib/cart/constants';
import { validateCart } from '@/lib/cart/validation';
import { parseContact, CheckoutError } from './schemas';
import {
  emptyContact,
  type CheckoutView,
  type ContactValues,
  type AddressValues,
} from './types';
import { getAvailableShippingMethods } from './shipping';
import type { CheckoutData, CheckoutRecord } from './queries';

export function contactFromSession(
  session: CheckoutRecord | null,
): ContactValues {
  if (!session) return emptyContact();
  const toAddress = (role: 'SHIPPING' | 'BILLING'): AddressValues | null => {
    const row = session.addresses.find((address) => address.role === role);
    return row
      ? {
          firstName: row.firstName,
          lastName: row.lastName,
          company: row.company ?? '',
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2 ?? '',
          postalCode: row.postalCode,
          city: row.city,
          region: row.region ?? '',
          countryCode: row.countryCode,
          phone: row.phone ?? '',
        }
      : null;
  };
  return {
    email: session.email ?? '',
    phone: session.phone ?? '',
    billingSame: session.billingSame,
    shipping: toAddress('SHIPPING') ?? emptyContact().shipping,
    billing: toAddress('BILLING'),
  };
}
export function checkoutFingerprint(data: CheckoutData, view: CheckoutView) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contact: view.contact,
        items: view.cart.items.map((i) => ({
          id: i.variantId,
          quantity: i.quantity,
          price: i.price,
          maxQuantity: i.maxQuantity,
          issue: i.issue,
        })),
        shipping: view.selectedMethod,
        methodVersion: data.methods.find(
          (m) => m.id === view.selectedMethod?.id,
        )?.updatedAt,
      }),
    )
    .digest('hex');
}
export function getCheckoutSummary(data: CheckoutData): CheckoutView {
  const { cart: record, session, countries, methods: rules } = data;
  const cart = serializeCart(record),
    contact = contactFromSession(session);
  const expired = Boolean(
    session &&
    (session.expiresAt <= new Date() || session.status === 'EXPIRED'),
  );
  const blocked =
    !validateCart(record).valid ||
    record.items.some(
      (i) =>
        !Number.isSafeInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > MAX_CART_ITEM_QUANTITY ||
        !i.variant.price.isFinite() ||
        i.variant.price.isNegative(),
    );
  let contactValid = false;
  try {
    parseContact(
      contact,
      countries.map((country) => country.code),
    );
    contactValid = Boolean(session) && !expired;
  } catch {
    /* An incomplete draft determines the first accessible step. */
  }
  const subtotal = new Prisma.Decimal(cart.subtotal);
  const methods = contactValid
    ? getAvailableShippingMethods(rules, contact.shipping.countryCode, subtotal)
    : [];
  const selectedMethod =
    methods.find((method) => method.id === session?.shippingMethodId) ?? null;
  const shippingAmount = selectedMethod?.amount ?? null;
  const view: CheckoutView = {
    sessionId: session?.id ?? null,
    status: expired ? 'EXPIRED' : 'IN_PROGRESS',
    contact,
    countries,
    methods,
    selectedMethod,
    cart,
    shippingAmount,
    total:
      shippingAmount === null ? null : subtotal.plus(shippingAmount).toFixed(2),
    requiredStep: !contactValid
      ? 'contact'
      : !selectedMethod
        ? 'shipping'
        : 'review',
    blocked,
    notice: blocked
      ? 'Votre panier a changé depuis le début de votre commande. Vérifiez votre panier avant de poursuivre.'
      : expired
        ? 'Votre session de commande a expiré. Votre panier reste disponible ; démarrez une nouvelle session.'
        : session?.shippingMethodId && !selectedMethod
          ? 'Votre livraison doit être choisie à nouveau pour cette destination.'
          : null,
  };
  if (
    !expired &&
    !blocked &&
    contactValid &&
    selectedMethod &&
    session?.status === 'READY_FOR_PAYMENT' &&
    session.readyFingerprint === checkoutFingerprint(data, view)
  )
    view.status = 'READY_FOR_PAYMENT';
  if (
    session?.status === 'READY_FOR_PAYMENT' &&
    view.status === 'IN_PROGRESS' &&
    !view.notice
  )
    view.notice =
      'Votre sélection ou les tarifs ont changé. Vérifiez le récapitulatif avant de le valider à nouveau.';
  return view;
}
export function validateCheckout(data: CheckoutData) {
  const view = getCheckoutSummary(data);
  if (!data.session || view.status === 'EXPIRED')
    throw new CheckoutError(
      'Votre session a expiré. Recommencez depuis votre panier.',
    );
  if (view.blocked || !view.cart.items.length)
    throw new CheckoutError(
      'Votre panier doit être mis à jour avant de poursuivre.',
    );
  parseContact(
    view.contact,
    view.countries.map((country) => country.code),
  );
  if (!view.selectedMethod)
    throw new CheckoutError('Choisissez un mode de livraison disponible.');
  return { view, fingerprint: checkoutFingerprint(data, view) };
}
