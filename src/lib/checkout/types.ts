import type { CartView } from '@/lib/cart/types';
export type CheckoutStep = 'contact' | 'shipping' | 'review';
export type AddressValues = {
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  region: string;
  countryCode: string;
  phone: string;
};
export type ContactValues = {
  email: string;
  phone: string;
  billingSame: boolean;
  shipping: AddressValues;
  billing: AddressValues | null;
};
export type CountryView = { code: string; name: string };
export type ShippingMethodView = {
  id: string;
  name: string;
  description: string | null;
  amount: string;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  isDevelopment: boolean;
};
export type CheckoutView = {
  sessionId: string | null;
  status: 'IN_PROGRESS' | 'READY_FOR_PAYMENT' | 'EXPIRED';
  contact: ContactValues;
  countries: CountryView[];
  methods: ShippingMethodView[];
  selectedMethod: ShippingMethodView | null;
  cart: CartView;
  /** Price of the chosen delivery, before a free-shipping code. */
  shippingAmount: string | null;
  /** Code applied and valid now. */
  promotion: {
    code: string;
    label: string;
    /** Taken off the items. */
    discount: string;
    /** Taken off the shipping. */
    shippingDiscount: string;
    items: { itemId: string; amount: string }[];
  } | null;
  /** Code applied that cannot be used any more, and why. */
  promotionIssue: { code: string; message: string } | null;
  /** subtotal − discount + shipping − shipping discount. */
  total: string | null;
  /** Items after discount: what is shown while no delivery is chosen. */
  provisionalTotal: string;
  requiredStep: CheckoutStep;
  blocked: boolean;
  notice: string | null;
};
export type CheckoutActionResult = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
  next?: CheckoutStep;
};
export const emptyAddress = (): AddressValues => ({
  firstName: '',
  lastName: '',
  company: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  region: '',
  countryCode: 'FR',
  phone: '',
});
export const emptyContact = (): ContactValues => ({
  email: '',
  phone: '',
  billingSame: true,
  shipping: emptyAddress(),
  billing: null,
});


export type CartPromotionState = {
  promotion: CheckoutView['promotion'];
  promotionIssue: CheckoutView['promotionIssue'];
  provisionalTotal: string;
};

export type CartPromotionActionResult = {
  success: boolean;
  message: string;
  state: CartPromotionState | null;
};

export function toCartPromotionState(
  view: CheckoutView | null,
): CartPromotionState | null {
  if (!view) return null;
  return {
    promotion: view.promotion,
    promotionIssue: view.promotionIssue,
    provisionalTotal: view.provisionalTotal,
  };
}
