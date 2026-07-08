'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/lib/api/auth';
import { tokenStore } from '@/lib/api-client';
import { useAppDispatch } from '@/lib/hooks';
import { setUser } from '@/lib/features/auth/authSlice';

/**
 * Client-side gate for authenticated areas. Resolves the current user via
 * the API (using the refresh token to mint an access token if needed) and
 * redirects to /login when there is no valid session.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: typeof window !== 'undefined' && !!tokenStore.getRefresh(),
    retry: false,
  });

  useEffect(() => {
    if (data) dispatch(setUser(data));
  }, [data, dispatch]);

  useEffect(() => {
    const hasSession = typeof window !== 'undefined' && !!tokenStore.getRefresh();
    if (!hasSession || isError) {
      router.replace('/login');
    }
  }, [isError, router]);

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
