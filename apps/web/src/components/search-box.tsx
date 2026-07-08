'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, FileText, LayoutTemplate } from 'lucide-react';
import { globalSearch } from '@/lib/api/search';
import { useTemplate } from '@/lib/api/templates';

/** Debounced global search with a results dropdown (designs + templates). */
export function SearchBox() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounce keystrokes → 300ms.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.length >= 2,
  });

  const results = data?.results ?? [];

  const openProject = (id: string) => {
    setOpen(false);
    setTerm('');
    router.push(`/design/${id}`);
  };

  const openTemplate = async (id: string) => {
    setOpen(false);
    setTerm('');
    const project = await useTemplate(id);
    router.push(`/design/${project.id}`);
  };

  return (
    <div ref={wrapRef} className="relative hidden w-full max-w-md sm:block">
      <div className="flex items-center gap-2 rounded-md border bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search your designs and templates…"
          className="h-9 w-full bg-transparent text-sm outline-none"
        />
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {isFetching ? 'Searching…' : 'No results'}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    onClick={() => (r.kind === 'project' ? openProject(r.id) : openTemplate(r.id))}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {r.kind === 'project' ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <LayoutTemplate className="h-4 w-4 text-primary" />
                    )}
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="text-xs capitalize text-muted-foreground">{r.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data?.engine && (
            <div className="border-t px-3 py-1 text-[10px] text-muted-foreground">
              via {data.engine}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
