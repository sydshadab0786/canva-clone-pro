import Link from 'next/link';
import { ArrowRight, Sparkles, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

const features = [
  { icon: Sparkles, title: 'AI-powered design', body: 'Generate images, copy and layouts in seconds.' },
  { icon: Layers, title: 'Pro editor', body: 'Infinite canvas, layers, and pixel-perfect control.' },
  { icon: Users, title: 'Real-time collab', body: 'Design together with live cursors and comments.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="container flex h-16 items-center justify-between">
        <span className="text-lg font-bold">
          Canva<span className="text-primary">Clone</span> Pro
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <section className="container flex flex-col items-center py-24 text-center">
        <span className="mb-4 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Design anything. Publish anywhere.
        </span>
        <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight sm:text-6xl">
          The complete design platform for{' '}
          <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
            teams that ship
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Create graphics, presentations, videos, logos and websites — powered by AI and built for
          real-time collaboration.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Start designing <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              I already have an account
            </Button>
          </Link>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border p-6">
            <f.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
