'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, ScrollText, Flag, ChevronLeft } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAppSelector } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/flags', label: 'Feature Flags', icon: Flag },
];

function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  if (!user) return null; // AuthGuard shows the spinner
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        You do not have access to the admin panel.
      </div>
    );
  }
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthGuard>
      <AdminGate>
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r p-4">
            <Link href="/dashboard" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Back to app
            </Link>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-bold">Admin</span>
              <ThemeToggle />
            </div>
            <nav className="space-y-1">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </AdminGate>
    </AuthGuard>
  );
}
