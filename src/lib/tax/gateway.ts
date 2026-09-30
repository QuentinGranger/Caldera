import 'server-only';
import Stripe from 'stripe';
import { OrderError } from '@/lib/orders/common';
import { getStripe } from '@/lib/stripe/stripe';

/** Stripe Tax result: VAT included in each line, rate in percent. */
export type TaxCalculation = {
  id: string;
  lines: { reference: string; taxCents: number; rate: string | null }[];
  shipping: { taxCents: number; rate: string | null };
  taxCents: number;
};

export class TaxProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export interface TaxGateway {
  calculate(input: {
    lines: { reference: string; amountCents: number; taxCode: string }[];
    shipping: { amountCents: number; taxCode: string };
    address: {
      line1: string;
      line2: string | null;
      postalCode: string;
      city: string;
      country: string;
    };
  }): Promise<TaxCalculation>;
  /** Records the sale in the tax reports; one per order (idempotent). */
  record(
    calculationId: string,
    reference: string,
    key: string,
  ): Promise<string>;
  /** Reverses a refunded amount (VAT included) of a recorded sale. */
  reverse(
    transactionId: string,
    reference: string,
    amountCents: number,
    key: string,
  ): Promise<string>;
  /** Whether Stripe Tax is set up on the account (head office, registration). */
  status(): Promise<{ status: string; missing: string[] }>;
}

function rateOf(
  breakdown:
    | { tax_rate_details: { percentage_decimal: string } | null }[]
    | null
    | undefined,
) {
  const rate = breakdown?.find((row) => row.tax_rate_details)?.tax_rate_details
    ?.percentage_decimal;
  return rate ? Number(rate).toFixed(2) : null;
}

function fail(error: unknown): never {
  if (error instanceof OrderError)
    throw new TaxProviderError('STRIPE_NON_CONFIGURE');
  if (error instanceof Stripe.errors.StripePermissionError)
    throw new TaxProviderError('PERMISSION_STRIPE_TAX_MANQUANTE');
  if (error instanceof Stripe.errors.StripeError)
    throw new TaxProviderError(
      (error.code ?? error.type ?? 'STRIPE_ERROR').slice(0, 64),
    );
  throw new TaxProviderError('STRIPE_INJOIGNABLE');
}

export const stripeTaxGateway: TaxGateway = {
  async calculate({ lines, shipping, address }) {
    try {
      const calculation = await getStripe().tax.calculations.create({
        currency: 'eur',
        // Prices are shown VAT included: Stripe extracts the VAT.
        line_items: lines.map((line) => ({
          amount: line.amountCents,
          reference: line.reference,
          tax_behavior: 'inclusive',
          tax_code: line.taxCode,
        })),
        shipping_cost: {
          amount: shipping.amountCents,
          tax_behavior: 'inclusive',
          tax_code: shipping.taxCode,
        },
        customer_details: {
          address: {
            line1: address.line1,
            line2: address.line2 ?? undefined,
            postal_code: address.postalCode,
            city: address.city,
            country: address.country,
          },
          address_source: 'shipping',
        },
        expand: ['line_items'],
      });
      if (!calculation.id)
        throw new TaxProviderError('CALCUL_SANS_IDENTIFIANT');
      return {
        id: calculation.id,
        lines: (calculation.line_items?.data ?? []).map((line) => ({
          reference: line.reference,
          taxCents: line.amount_tax,
          rate: rateOf(line.tax_breakdown),
        })),
        shipping: {
          taxCents: calculation.shipping_cost?.amount_tax ?? 0,
          rate: rateOf(calculation.shipping_cost?.tax_breakdown),
        },
        taxCents: calculation.tax_amount_inclusive,
      };
    } catch (error) {
      if (error instanceof TaxProviderError) throw error;
      fail(error);
    }
  },
  async record(calculationId, reference, key) {
    try {
      const transaction =
        await getStripe().tax.transactions.createFromCalculation(
          { calculation: calculationId, reference },
          { idempotencyKey: key },
        );
      return transaction.id;
    } catch (error) {
      fail(error);
    }
  },
  async reverse(transactionId, reference, amountCents, key) {
    try {
      const reversal = await getStripe().tax.transactions.createReversal(
        {
          mode: 'partial',
          original_transaction: transactionId,
          reference,
          flat_amount: -amountCents,
        },
        { idempotencyKey: key },
      );
      return reversal.id;
    } catch (error) {
      fail(error);
    }
  },
  async status() {
    try {
      const settings = await getStripe().tax.settings.retrieve();
      return {
        status: settings.status,
        missing:
          settings.status === 'pending'
            ? (settings.status_details.pending?.missing_fields ?? [])
            : [],
      };
    } catch (error) {
      fail(error);
    }
  },
};
