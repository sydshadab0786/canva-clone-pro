'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Trash2, Loader2, RotateCcw } from 'lucide-react';
import {
  addComment,
  deleteComment,
  listComments,
  resolveComment,
  type Comment,
} from '@/lib/api/comments';
import { useAppSelector } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Highlight @mentions in a comment body. */
function renderBody(body: string) {
  return body.split(/(@[a-zA-Z0-9_]{3,30})/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function CommentsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const me = useAppSelector((s) => s.auth.user);
  const [draft, setDraft] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['comments', projectId],
    queryFn: () => listComments(projectId),
    enabled: !!projectId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['comments', projectId] });

  const add = useMutation({
    mutationFn: () => addComment(projectId, draft.trim()),
    onSuccess: () => {
      setDraft('');
      invalidate();
    },
  });
  const resolve = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => resolveComment(id, resolved),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteComment(id), onSuccess: invalidate });

  const comments: Comment[] = data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">Comments</div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            No comments yet. Mention teammates with @username.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={`rounded-md border p-2 ${c.resolvedAt ? 'opacity-60' : ''}`}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold">{c.author.displayName}</span>
                <span className="text-[10px] text-muted-foreground">{formatTime(c.createdAt)}</span>
              </div>
              <p className="text-sm">{renderBody(c.body)}</p>
              <div className="mt-1 flex gap-1">
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                  aria-label={c.resolvedAt ? 'Reopen' : 'Resolve'}
                  onClick={() => resolve.mutate({ id: c.id, resolved: !c.resolvedAt })}
                >
                  {c.resolvedAt ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                {(c.authorId === me?.id) && (
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Delete"
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3">
        <textarea
          className="w-full rounded-md border bg-background p-2 text-sm"
          rows={2}
          placeholder="Add a comment… use @username to mention"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button size="sm" className="mt-2 w-full" loading={add.isPending} disabled={!draft.trim()} onClick={() => add.mutate()}>
          Comment
        </Button>
      </div>
    </div>
  );
}
