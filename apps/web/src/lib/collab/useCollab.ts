'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '@/lib/api-client';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { editorActions, selectDocument } from '@/lib/features/editor/editorSlice';
import type { SceneDocument } from '@/lib/editor/types';

export interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

export interface RemoteCursor {
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  ts: number;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
const CURSOR_TTL = 5000;
const BROADCAST_MS = 250;

/**
 * Real-time collaboration for one project. Connects to the `/collab` Socket.io
 * namespace, syncs presence + remote cursors, mirrors document edits to peers,
 * and applies inbound edits to the editor store.
 *
 * Sync model: whichever client edits broadcasts its full document (debounced);
 * peers replace their document without creating history. Last-write-wins — a
 * pragmatic foundation; CRDT/OT merges land in a later refinement.
 */
export function useCollab(projectId: string | null) {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectDocument);
  const dirty = useAppSelector((s) => s.editor.dirty);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});

  const socketRef = useRef<Socket | null>(null);
  // The last document we received from a peer — used to avoid echoing it back.
  const remoteDocRef = useRef<SceneDocument | null>(null);
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Connect / join ────────────────────────────────────────────────
  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!projectId || !token) return;

    const socket = io(`${WS_URL}/collab`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('project:join', { projectId }));
    socket.on('presence:state', (list: Participant[]) => setParticipants(list));
    socket.on('cursor:move', (c: Omit<RemoteCursor, 'ts'>) =>
      setCursors((prev) => ({ ...prev, [c.userId]: { ...c, ts: Date.now() } })),
    );
    socket.on('presence:leave', ({ userId }: { userId: string }) =>
      setCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      }),
    );
    socket.on('scene:op', (payload: { op?: { document?: SceneDocument } }) => {
      const incoming = payload?.op?.document;
      if (incoming) {
        remoteDocRef.current = incoming;
        dispatch(editorActions.applyRemoteDocument(incoming));
      }
    });

    return () => {
      socket.emit('project:leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, dispatch]);

  // ── Broadcast local edits (debounced) ─────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !dirty) return;
    // Skip if this document is exactly what a peer just sent us.
    if (doc === remoteDocRef.current) return;
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    broadcastTimer.current = setTimeout(() => {
      socket.emit('scene:op', { document: doc });
    }, BROADCAST_MS);
    return () => {
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    };
  }, [doc, dirty]);

  // ── Prune stale cursors ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const next: Record<string, RemoteCursor> = {};
        for (const [id, c] of Object.entries(prev)) if (now - c.ts < CURSOR_TTL) next[id] = c;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const emitCursor = (x: number, y: number) => {
    socketRef.current?.emit('cursor:move', { x, y });
  };

  return { participants, cursors, emitCursor };
}
