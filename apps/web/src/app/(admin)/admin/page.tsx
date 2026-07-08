'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, FileImage, LayoutTemplate, HardDrive, CreditCard, DollarSign } from 'lucide-react';
import {
  adminActivity,
  adminOverview,
  adminProjects,
  adminSignups,
  adminTopTemplates,
} from '@/lib/api/admin';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'usd' }).format(cents / 100);

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: adminOverview });
  const signups = useQuery({ queryKey: ['admin', 'signups'], queryFn: () => adminSignups(30) });
  const projects = useQuery({ queryKey: ['admin', 'projects'], queryFn: () => adminProjects(30) });
  const templates = useQuery({ queryKey: ['admin', 'top-templates'], queryFn: adminTopTemplates });
  const activity = useQuery({ queryKey: ['admin', 'activity'], queryFn: adminActivity });

  const o = overview.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat icon={Users} label="Users" value={o?.users ?? '—'} />
        <Stat icon={FileImage} label="Projects" value={o?.projects ?? '—'} />
        <Stat icon={LayoutTemplate} label="Templates" value={o?.templates ?? '—'} />
        <Stat icon={HardDrive} label="Assets" value={o?.assets ?? '—'} />
        <Stat icon={CreditCard} label="Subscriptions" value={o?.activeSubscriptions ?? '—'} />
        <Stat icon={DollarSign} label="MRR" value={o ? money(o.mrrCents) : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signups (30 days)</CardTitle>
          </CardHeader>
          <CardContent>{signups.data && <LineChart data={signups.data} />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects created (30 days)</CardTitle>
          </CardHeader>
          <CardContent>{projects.data && <LineChart data={projects.data} color="hsl(199 89% 48%)" />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top templates</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={(templates.data ?? []).map((t) => ({ label: t.title, value: t.usageCount }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity by action</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={(activity.data ?? []).map((a) => ({ label: a.action, value: a.count }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
