'use client';

import { useRef, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { makeStore, type AppStore } from '@/lib/store';

/**
 * Client-side provider tree: theme (dark/light), Redux, React Query.
 * Store + QueryClient are created once per mount via refs so Fast Refresh
 * and SSR hydration don't recreate them on every render.
 */
export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  const queryRef = useRef<QueryClient | null>(null);
  if (!queryRef.current) {
    queryRef.current = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      },
    });
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ReduxProvider store={storeRef.current}>
        <QueryClientProvider client={queryRef.current}>{children}</QueryClientProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}
