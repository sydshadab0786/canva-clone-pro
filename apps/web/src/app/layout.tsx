import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

// Uses a system font stack (see tailwind.config `fontFamily.sans`) rather than
// next/font/google, so builds and dev startup have no network dependency —
// important for CI, air-gapped deploys, and reproducibility.

export const metadata: Metadata = {
  title: 'Canva Clone Pro',
  description: 'Create professional graphics, presentations, videos and more.',
  applicationName: 'Canva Clone Pro',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
