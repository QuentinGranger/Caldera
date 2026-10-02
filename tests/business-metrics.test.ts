import assert from 'node:assert/strict';
import test from 'node:test';
import {
  breakEvenRevenue,
  estimatedPaymentFees,
  monthlyOperatingBudget,
  reinvestmentCapacity,
} from '@/lib/finance/businessMetrics';

test('estimatedPaymentFees combines percentage and fixed fee per order', () => {
  assert.equal(
    estimatedPaymentFees({
      collected: 1000,
      orderCount: 10,
      percentageRate: 1.5,
      fixedFee: 0.25,
    }),
    17.5,
  );
});

test('monthlyOperatingBudget adds all operating envelopes', () => {
  assert.equal(
    monthlyOperatingBudget({
      fixed: 100,
      packaging: 40,
      shipping: 60,
      marketing: 50,
      other: 25,
    }),
    275,
  );
});

test('breakEvenRevenue accounts for payment fees', () => {
  const result = breakEvenRevenue({
    monthlyOperatingCosts: 300,
    grossMarginRate: 25,
    paymentFeeRate: 1.5,
    averageOrderValue: 50,
    paymentFixedFee: 0.25,
  });
  assert.equal(result?.toFixed(2), '1304.35');
});

test('breakEvenRevenue is unavailable with no positive contribution', () => {
  assert.equal(
    breakEvenRevenue({
      monthlyOperatingCosts: 300,
      grossMarginRate: 1,
      paymentFeeRate: 2,
      averageOrderValue: 50,
      paymentFixedFee: 0.25,
    }),
    null,
  );
});

test('reinvestmentCapacity protects reserve and stock ceiling', () => {
  assert.deepEqual(
    reinvestmentCapacity({
      cashBalance: 1000,
      reserveTarget: 250,
      reinvestmentRate: 50,
      stockBudget: 1200,
      stockValue: 950,
    }),
    {
      cashAboveReserve: 750,
      stockHeadroom: 250,
      capacity: 250,
    },
  );
});
