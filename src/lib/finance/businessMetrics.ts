export function percentOf(value: number, rate: number) {
  return value * (rate / 100);
}

export function monthlyOperatingBudget(parts: {
  fixed: number;
  packaging: number;
  shipping: number;
  marketing: number;
  other: number;
}) {
  return (
    parts.fixed +
    parts.packaging +
    parts.shipping +
    parts.marketing +
    parts.other
  );
}

export function estimatedPaymentFees(input: {
  collected: number;
  orderCount: number;
  percentageRate: number;
  fixedFee: number;
}) {
  return (
    percentOf(input.collected, input.percentageRate) +
    input.orderCount * input.fixedFee
  );
}

export function breakEvenRevenue(input: {
  monthlyOperatingCosts: number;
  grossMarginRate: number;
  paymentFeeRate: number;
  averageOrderValue: number | null;
  paymentFixedFee: number;
}) {
  const fixedFeeEquivalentRate =
    input.averageOrderValue && input.averageOrderValue > 0
      ? (input.paymentFixedFee / input.averageOrderValue) * 100
      : 0;
  const contributionRate =
    input.grossMarginRate - input.paymentFeeRate - fixedFeeEquivalentRate;
  if (contributionRate <= 0) return null;
  return input.monthlyOperatingCosts / (contributionRate / 100);
}

export function reinvestmentCapacity(input: {
  cashBalance: number;
  reserveTarget: number;
  reinvestmentRate: number;
  stockBudget: number;
  stockValue: number;
}) {
  const cashAboveReserve = Math.max(
    0,
    input.cashBalance - input.reserveTarget,
  );
  const authorizedCash = percentOf(cashAboveReserve, input.reinvestmentRate);
  const stockHeadroom = Math.max(0, input.stockBudget - input.stockValue);
  return {
    cashAboveReserve,
    stockHeadroom,
    capacity: Math.min(authorizedCash, stockHeadroom),
  };
}
