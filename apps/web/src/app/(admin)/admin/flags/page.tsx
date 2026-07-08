'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { adminFeatureFlags, upsertFeatureFlag, type FeatureFlag } from '@/lib/api/admin';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminFlagsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'flags'], queryFn: adminFeatureFlags });

  const update = useMutation({
    mutationFn: (flag: FeatureFlag) => upsertFeatureFlag(flag),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const flags: FeatureFlag[] = data ?? [];

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground">Toggle features and set gradual rollout percentages.</p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        flags.map((flag) => (
          <Card key={flag.key}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{flag.key}</p>
                <p className="text-xs text-muted-foreground">{flag.description}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{flag.rolloutPercent}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={flag.rolloutPercent}
                    disabled={!flag.enabled}
                    onChange={(e) => update.mutate({ ...flag, rolloutPercent: Number(e.target.value) })}
                  />
                </div>
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={flag.enabled}
                    onChange={(e) => update.mutate({ ...flag, enabled: e.target.checked })}
                  />
                  <div className="h-6 w-11 rounded-full bg-muted after:absolute after:ml-0.5 after:mt-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-5" />
                </label>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
