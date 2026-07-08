'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Sparkles, Tag } from 'lucide-react';
import {
  cancelSubscription,
  checkout,
  getInvoices,
  getSubscription,
  listPlans,
  previewCheckout,
  type Plan,
} from '@/lib/api/billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

function planFeatures(p: Plan): string[] {
  return [
    p.aiCredits > 0 ? `${p.aiCredits.toLocaleString()} AI credits / mo` : 'No AI credits',
    `${(p.storageMb / 1000).toLocaleString()} GB storage`,
    p.code === 'free' ? 'Basic templates' : 'Premium templates & fonts',
    p.code === 'team' ? 'Team workspace & roles' : 'Personal workspace',
  ];
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>(undefined);

  const sub = useQuery({ queryKey: ['subscription'], queryFn: getSubscription });
  const plans = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  const doCheckout = useMutation({
    mutationFn: (planCode: string) => checkout(planCode, appliedCoupon),
    onSuccess: (res) => {
      if (res.mode === 'redirect' && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  });

  const currentCode = sub.data?.plan?.code;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription, credits and invoices.</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Current plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sub.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{sub.data?.plan?.name ?? 'Free'}</p>
                <p className="text-sm text-muted-foreground">
                  {sub.data?.aiCreditsRemaining ?? 0} AI credits remaining
                  {sub.data?.cancelAtPeriodEnd && ' · cancels at period end'}
                </p>
              </div>
              {sub.data?.id && !sub.data.cancelAtPeriodEnd && (
                <Button variant="outline" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
                  Cancel subscription
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coupon */}
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Coupon code (try WELCOME20)"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="secondary" size="sm" onClick={() => setAppliedCoupon(coupon.trim() || undefined)}>
          Apply
        </Button>
        {appliedCoupon && <span className="text-xs text-green-600">Applied: {appliedCoupon}</span>}
      </div>

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.data?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={currentCode === p.code}
            coupon={appliedCoupon}
            onSelect={() => doCheckout.mutate(p.code)}
            pending={doCheckout.isPending}
          />
        ))}
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (invoices.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Invoice</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data!.map((inv) => (
                  <tr key={inv.id} className="border-b">
                    <td className="py-2 font-mono text-xs">{inv.id}</td>
                    <td>{inv.planName}</td>
                    <td>{money(inv.amountCents, inv.currency)}</td>
                    <td className="capitalize">{inv.status.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  coupon,
  onSelect,
  pending,
}: {
  plan: Plan;
  current: boolean;
  coupon?: string;
  onSelect: () => void;
  pending: boolean;
}) {
  const preview = useQuery({
    queryKey: ['preview', plan.code, coupon],
    queryFn: () => previewCheckout(plan.code, coupon),
    enabled: plan.priceCents > 0,
  });

  const discounted = preview.data && preview.data.discountCents > 0;

  return (
    <div className={cn('flex flex-col rounded-xl border p-5', current && 'border-primary ring-1 ring-primary')}>
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <div className="mt-1">
        {discounted ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{money(preview.data!.totalCents)}</span>
            <span className="text-sm text-muted-foreground line-through">{money(plan.priceCents)}</span>
          </div>
        ) : (
          <span className="text-2xl font-bold">{plan.priceCents === 0 ? 'Free' : money(plan.priceCents)}</span>
        )}
        {plan.priceCents > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
      </div>

      <ul className="my-4 flex-1 space-y-2 text-sm">
        {planFeatures(plan).map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" /> {f}
          </li>
        ))}
      </ul>

      <Button disabled={current || pending} loading={pending} onClick={onSelect} variant={current ? 'outline' : 'default'}>
        {current ? 'Current plan' : plan.priceCents === 0 ? 'Downgrade' : 'Upgrade'}
      </Button>
    </div>
  );
}
