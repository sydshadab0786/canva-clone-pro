'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Clock,
  Folder,
  Star,
  Trash2,
  LayoutTemplate,
  Palette,
  Upload,
  Bell,
  Settings,
  LogOut,
  CreditCard,
  Shield,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { ThemeToggle } from '@/components/theme-toggle';
import { SearchBox } from '@/components/search-box';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { clearUser } from '@/lib/features/auth/authSlice';
import { logout } from '@/lib/api/auth';

const NAV = [
  { href: '/dashboard', label: 'Recent', icon: Clock },
  { href: '/dashboard/folders', label: 'Folders', icon: Folder },
  { href: '/dashboard/favorites', label: 'Favorites', icon: Star },
  { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/dashboard/brand-kit', label: 'Brand Kit', icon: Palette },
  { href: '/dashboard/uploads', label: 'Uploads', icon: Upload },
  { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
];

function Sidebar() {
  const pathname = usePathname();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  return (
    <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
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
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'mt-2 flex items-center gap-3 rounded-md border-t px-3 py-2 pt-4 text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}
      </nav>
    </aside>
  );
}

function Topbar() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  async function onLogout() {
    await logout();
    dispatch(clearUser());
    router.replace('/login');
  }

  return (
    <header className="flex h-16 items-center gap-4 border-b px-6">
      <Link href="/dashboard" className="shrink-0 text-lg font-bold">
        Canva<span className="text-primary">Clone</span> Pro
      </Link>
      <div className="flex flex-1 justify-center">
        <SearchBox />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
        <ThemeToggle />
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="icon" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">{user?.displayName}</span>
        <Button variant="ghost" size="icon" aria-label="Log out" onClick={onLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
