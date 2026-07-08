import { describe, expect, it } from 'vitest';
import {
  discountFor,
  priceWithCoupon,
  prorate,
  validateCoupon,
  type Coupon,
} from './pricing.util';

const NOW = 1_000_000_000_000;

const percent = (over: Partial<Coupon> = {}): Coupon => ({ code: 'SAVE20', type: 'percent', value: 20, ...over });
const fixed = (over: Partial<Coupon> = {}): Coupon => ({ code: 'TEN', type: 'fixed', value: 1000, ...over });

describe('coupon validation', () => {
  it('accepts a valid percent coupon', () => {
    expect(validateCoupon(percent(), 5000, NOW).ok).toBe(true);
  });
  it('rejects a null coupon and out-of-range values', () => {
    expect(validateCoupon(null, 5000, NOW)).toMatchObject({ ok: false, error: 'not-found' });
    expect(validateCoupon(percent({ value: 150 }), 5000, NOW)).toMatchObject({ ok: false, error: 'invalid' });
  });
  it('rejects expired coupons', () => {
    expect(validateCoupon(percent({ expiresAt: NOW - 1 }), 5000, NOW)).toMatchObject({ ok: false, error: 'expired' });
  });
  it('enforces minimum amount', () => {
    expect(validateCoupon(percent({ minAmountCents: 6000 }), 5000, NOW)).toMatchObject({ ok: false, error: 'below-minimum' });
  });
  it('enforces redemption limit', () => {
    expect(validateCoupon(percent({ maxRedemptions: 2, timesRedeemed: 2 }), 5000, NOW)).toMatchObject({ ok: false, error: 'redemption-limit' });
  });
});

describe('discount + total', () => {
  it('applies a percentage discount', () => {
    expect(discountFor(percent(), 5000)).toBe(1000); // 20%
  });
  it('applies a fixed discount capped at the subtotal', () => {
    expect(discountFor(fixed({ value: 8000 }), 5000)).toBe(5000);
  });
  it('produces a full breakdown and ignores invalid coupons', () => {
    expect(priceWithCoupon(5000, percent(), NOW)).toEqual({
      subtotalCents: 5000,
      discountCents: 1000,
      totalCents: 4000,
      couponCode: 'SAVE20',
    });
    expect(priceWithCoupon(5000, percent({ expiresAt: NOW - 1 }), NOW)).toMatchObject({
      discountCents: 0,
      totalCents: 5000,
      couponCode: null,
    });
  });
});

describe('proration', () => {
  it('credits the unused portion of the current plan', () => {
    const start = 0;
    const end = 100;
    // Halfway through: 50% of the old $12.99 is credited against the new $29.99.
    // Final total is rounded: round(2999 - 649.5) = 2350.
    const due = prorate(1299, 2999, start, end, 50);
    expect(due).toBe(Math.round(2999 - 1299 * 0.5));
    expect(due).toBe(2350);
  });
  it('never returns negative amounts', () => {
    expect(prorate(9999, 1000, 0, 100, 0)).toBe(0);
  });
});
