'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Crown } from 'lucide-react';
import {
  listTemplates,
  listTemplateCategories,
  useTemplate,
  type TemplateCard,
} from '@/lib/api/templates';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);

  const { data: cats } = useQuery({
    queryKey: ['template-categories'],
    queryFn: listTemplateCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['templates', category],
    queryFn: () => listTemplates({ category: category ?? undefined, page: 1 }),
  });

  const use = useMutation({
    mutationFn: (id: string) => useTemplate(id),
    onMutate: (id) => setUsingId(id),
    onSuccess: (project) => router.push(`/design/${project.id}`),
    onSettled: () => setUsingId(null),
  });

  const templates: TemplateCard[] = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Start from a professionally designed template.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory(null)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            !category ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          All
        </button>
        {(cats ?? []).map((c) => (
          <button
            key={c.category}
            onClick={() => setCategory(c.category)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              category === c.category ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            {c.category} <span className="opacity-60">({c.count})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No templates in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {templates.map((t) => {
            const ratio = t.width / t.height;
            return (
              <div key={t.id} className="group overflow-hidden rounded-lg border">
                <div
                  className="relative flex items-center justify-center bg-secondary"
                  style={{ aspectRatio: `${Math.max(0.5, Math.min(2, ratio))}` }}
                >
                  {t.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumbnailUrl} alt={t.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t.width}×{t.height}
                    </span>
                  )}
                  {t.isPremium && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Crown className="h-3 w-3" /> PRO
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      loading={use.isPending && usingId === t.id}
                      onClick={() => use.mutate(t.id)}
                    >
                      Use this template
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="truncate text-sm font-medium">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{t.usageCount} uses</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
