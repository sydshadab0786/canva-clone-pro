import { apiFetch } from '../api-client';

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  interval: string;
  aiCredits: number;
  storageMb: number;
}

export interface CurrentSubscription {
  id: string | null;
  planId: string | null;
  plan: Plan | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  aiCreditsRemaining: number;
  synthetic?: boolean;
}

export interface PriceBreakdown {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
  planCode: string;
}

export interface Invoice {
  id: string;
  planName: string;
  amountCents: number;
  currency: string;
  status: string;
  periodEnd: string | null;
  createdAt: string;
}

export const listPlans = () => apiFetch<Plan[]>('/billing/plans', { method: 'GET' });
export const getSubscription = () => apiFetch<CurrentSubscription>('/billing/subscription', { method: 'GET' });
export const getInvoices = () => apiFetch<Invoice[]>('/billing/invoices', { method: 'GET' });

export function previewCheckout(planCode: string, couponCode?: string): Promise<PriceBreakdown> {
  const q = new URLSearchParams({ planCode });
  if (couponCode) q.set('couponCode', couponCode);
  return apiFetch<PriceBreakdown>(`/billing/preview?${q.toString()}`, { method: 'GET' });
}

export function checkout(planCode: string, couponCode?: string) {
  return apiFetch<{ mode: string; checkoutUrl?: string; subscription?: CurrentSubscription }>(
    '/billing/checkout',
    { method: 'POST', body: { planCode, couponCode } },
  );
}

export const cancelSubscription = () => apiFetch('/billing/cancel', { method: 'POST' });
