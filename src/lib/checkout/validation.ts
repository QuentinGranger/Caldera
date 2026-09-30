import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { serializeCart } from '@/lib/cart/queries';
import { MAX_CART_ITEM_QUANTITY } from '@/lib/cart/constants';
import { validateCart } from '@/lib/cart/validation';
import { evaluatePromotion } from '@/lib/promotions/pricing';
import { fromCents, toCents } from '@/lib/refunds/amounts';
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
        promotion: view.promotion,
        promotionIssue: view.promotionIssue,
        promotionVersion: data.promotion?.updatedAt,
      }),
    )
    .digest('hex');
}
/** Cart lines as the promotion rules see them (valid cart only). */
export function promotionLines(record: CheckoutData['cart']) {
  return record.items.map((item) => ({
    id: item.id,
    unitCents: toCents(item.variant.price),
    quantity: item.quantity,
    gameId: item.variant.product.gameId,
    categoryId: item.variant.product.categoryId,
  }));
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
  const lines = blocked ? [] : promotionLines(record);
  const evaluate = (shippingCents: number | null) =>
    data.promotion && !blocked
      ? evaluatePromotion(data.promotion.rule, {
          lines,
          shippingCents,
          usage: data.promotion.usage,
        })
      : null;
  // The items discount comes first: free-shipping thresholds apply to what
  // the customer really pays for the items.
  const itemsOnly = evaluate(null);
  const methodsFor = (itemsDiscount: number) =>
    contactValid
      ? getAvailableShippingMethods(
          rules,
          contact.shipping.countryCode,
          subtotal.minus(fromCents(itemsDiscount)),
        )
      : [];
  let methods = methodsFor(itemsOnly?.ok ? itemsOnly.itemsCents : 0);
  let selectedMethod =
    methods.find((method) => method.id === session?.shippingMethodId) ?? null;
  const result = evaluate(
    selectedMethod ? toCents(selectedMethod.amount) : null,
  );
  if (itemsOnly?.ok && itemsOnly.itemsCents && !result?.ok) {
    methods = methodsFor(0);
    selectedMethod =
      methods.find((method) => method.id === session?.shippingMethodId) ?? null;
  }
  const shippingAmount = selectedMethod?.amount ?? null;
  const promotion =
    data.promotion && result?.ok
      ? {
          code: data.promotion.rule.code,
          label: data.promotion.rule.label,
          discount: fromCents(result.itemsCents),
          shippingDiscount: fromCents(result.shippingCents),
          items: result.items.map((item) => ({
            itemId: item.id,
            amount: fromCents(item.cents),
          })),
        }
      : null;
  const view: CheckoutView = {
    sessionId: session?.id ?? null,
    status: expired ? 'EXPIRED' : 'IN_PROGRESS',
    contact,
    countries,
    methods,
    selectedMethod,
    cart,
    shippingAmount,
    promotion,
    promotionIssue:
      data.promotion && result && !result.ok
        ? { code: data.promotion.rule.code, message: result.reason }
        : null,
    provisionalTotal: subtotal.minus(promotion?.discount ?? 0).toFixed(2),
    total:
      shippingAmount === null
        ? null
        : subtotal
            .minus(promotion?.discount ?? 0)
            .plus(shippingAmount)
            .minus(promotion?.shippingDiscount ?? 0)
            .toFixed(2),
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
  if (view.promotionIssue)
    throw new CheckoutError(
      `${view.promotionIssue.message} Retirez le code ${view.promotionIssue.code} pour continuer.`,
    );
  return { view, fingerprint: checkoutFingerprint(data, view) };
}
