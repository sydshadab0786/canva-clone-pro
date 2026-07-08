/**
 * Coupon + pricing maths. Pure and unit-tested. Amounts are integer cents to
 * avoid floating-point money errors.
 */

export type CouponType = 'percent' | 'fixed';

export interface Coupon {
  code: string;
  type: CouponType;
  /** percent: 0..100; fixed: cents off. */
  value: number;
  minAmountCents?: number;
  /** Epoch ms; undefined = no expiry. */
  expiresAt?: number;
  maxRedemptions?: number;
  timesRedeemed?: number;
}

export type CouponError =
  | 'not-found'
  | 'expired'
  | 'below-minimum'
  | 'redemption-limit'
  | 'invalid';

export interface PriceBreakdown {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
}

/** Clamp to a non-negative integer number of cents. */
function cents(n: number): number {
  return Math.max(0, Math.round(n));
}

export function validateCoupon(coupon: Coupon | null, subtotalCents: number, now: number):
  | { ok: true; coupon: Coupon }
  | { ok: false; error: CouponError } {
  if (!coupon) return { ok: false, error: 'not-found' };
  if (coupon.value <= 0) return { ok: false, error: 'invalid' };
  if (coupon.type === 'percent' && coupon.value > 100) return { ok: false, error: 'invalid' };
  if (coupon.expiresAt !== undefined && now > coupon.expiresAt) return { ok: false, error: 'expired' };
  if (coupon.minAmountCents !== undefined && subtotalCents < coupon.minAmountCents) {
    return { ok: false, error: 'below-minimum' };
  }
  if (
    coupon.maxRedemptions !== undefined &&
    (coupon.timesRedeemed ?? 0) >= coupon.maxRedemptions
  ) {
    return { ok: false, error: 'redemption-limit' };
  }
  return { ok: true, coupon };
}

export function discountFor(coupon: Coupon, subtotalCents: number): number {
  const raw =
    coupon.type === 'percent'
      ? (subtotalCents * coupon.value) / 100
      : coupon.value;
  // Discount never exceeds the subtotal.
  return Math.min(subtotalCents, cents(raw));
}

/** Compute a full price breakdown; an invalid/absent coupon is simply ignored. */
export function priceWithCoupon(
  subtotalCents: number,
  coupon: Coupon | null,
  now: number,
): PriceBreakdown {
  const validation = validateCoupon(coupon, subtotalCents, now);
  if (!validation.ok) {
    return { subtotalCents, discountCents: 0, totalCents: subtotalCents, couponCode: null };
  }
  const discountCents = discountFor(validation.coupon, subtotalCents);
  return {
    subtotalCents,
    discountCents,
    totalCents: cents(subtotalCents - discountCents),
    couponCode: validation.coupon.code,
  };
}

/**
 * Proration when switching plans mid-cycle: credit the unused portion of the
 * current plan against the new plan's price. Returns cents due now (>= 0).
 */
export function prorate(
  currentPriceCents: number,
  newPriceCents: number,
  periodStart: number,
  periodEnd: number,
  now: number,
): number {
  const span = periodEnd - periodStart;
  if (span <= 0) return cents(newPriceCents);
  const remaining = Math.max(0, Math.min(1, (periodEnd - now) / span));
  const credit = currentPriceCents * remaining;
  return cents(newPriceCents - credit);
}
