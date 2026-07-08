'use client';

import { use } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { EditorShell } from '@/components/editor/EditorShell';

/**
 * Full-screen editor route. `params` is a promise in Next 15 — unwrapped with
 * React `use()`. Gated behind AuthGuard so only signed-in users can edit.
 */
export default function DesignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <EditorShell id={id} />
    </AuthGuard>
  );
}
