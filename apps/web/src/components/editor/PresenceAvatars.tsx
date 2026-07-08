'use client';

import type { Participant } from '@/lib/collab/useCollab';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Stacked avatars of everyone currently in the design. */
export function PresenceAvatars({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) return null;
  return (
    <div className="flex items-center -space-x-2">
      {participants.slice(0, 5).map((p) => (
        <div
          key={p.userId}
          title={p.displayName}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
          style={{ backgroundColor: p.color }}
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt={p.displayName} className="h-full w-full rounded-full object-cover" />
          ) : (
            initials(p.displayName)
          )}
        </div>
      ))}
      {participants.length > 5 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold">
          +{participants.length - 5}
        </div>
      )}
    </div>
  );
}
