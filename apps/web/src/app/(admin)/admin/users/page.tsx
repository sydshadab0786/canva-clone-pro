'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { adminUsers, updateAdminUser, type AdminUser } from '@/lib/api/admin';
import { Input } from '@/components/ui/input';

const ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'];
const STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', debounced],
    queryFn: () => adminUsers({ search: debounced || undefined, page: 1 }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; status?: string } }) => updateAdminUser(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const users: AdminUser[] = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDebounced(search.trim());
        }}
        className="flex max-w-sm items-center gap-2 rounded-md border px-3"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="h-9 w-full bg-transparent text-sm outline-none"
        />
      </form>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">2FA</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{u.displayName}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <select
                      className="rounded border bg-background px-2 py-1 text-xs"
                      value={u.role}
                      onChange={(e) => update.mutate({ id: u.id, data: { role: e.target.value } })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      className="rounded border bg-background px-2 py-1 text-xs"
                      value={u.status}
                      onChange={(e) => update.mutate({ id: u.id, data: { status: e.target.value } })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">{u.twoFactorEnabled ? '✅' : '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{data?.total ?? 0} users</p>
    </div>
  );
}
