'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { adminAuditLogs, type AuditEntry } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () => adminAuditLogs(page),
  });

  const entries: AuditEntry[] = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-3">Action</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Target</th>
                <th className="p-3">IP</th>
                <th className="p-3">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{e.action}</td>
                  <td className="p-3">{e.user?.displayName ?? e.user?.email ?? 'system'}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {e.targetType ? `${e.targetType}:${e.targetId?.slice(0, 8)}` : '—'}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{e.ipAddress ?? '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {data?.page ?? 1} of {data?.totalPages ?? 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={(data && page >= data.totalPages) || isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
