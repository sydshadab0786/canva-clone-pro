'use client';

import { use } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { VideoShell } from '@/components/video/VideoShell';

/** Full-screen video editor route (Next 15 params promise unwrapped via use()). */
export default function VideoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <VideoShell id={id} />
    </AuthGuard>
  );
}
