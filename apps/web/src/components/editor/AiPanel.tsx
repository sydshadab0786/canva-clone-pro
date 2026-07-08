'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Wand2, Languages, Palette, Type, ShieldCheck, ImagePlus, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { editorActions, selectDocument, selectSelectedIds } from '@/lib/features/editor/editorSlice';
import { makeImage, makeText } from '@/lib/editor/document';
import {
  aiAccessibility,
  aiFonts,
  aiGenerateImage,
  aiPalette,
  aiRewrite,
  aiTranslate,
  aiWrite,
  type AccessibilityReport,
  type RewriteMode,
} from '@/lib/api/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function Section({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-b p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

export function AiPanel() {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectDocument);
  const selectedIds = useAppSelector(selectSelectedIds);
  const selected = doc.objects.find((o) => o.id === selectedIds[0]);
  const selectedText = selected?.type === 'text' ? selected : null;

  const [writePrompt, setWritePrompt] = useState('');
  const [translateTo, setTranslateTo] = useState('es');
  const [palettePrompt, setPalettePrompt] = useState('');
  const [fontKeyword, setFontKeyword] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [palette, setPalette] = useState<string[]>([]);
  const [report, setReport] = useState<AccessibilityReport | null>(null);

  // ── Mutations ──────────────────────────────────────────────────
  const write = useMutation({
    mutationFn: () => aiWrite(writePrompt),
    onSuccess: (r) =>
      dispatch(editorActions.addObject(makeText({ x: 100, y: 100, width: 480, text: r.text, fontSize: 40 }))),
  });

  const rewrite = useMutation({
    mutationFn: (mode: RewriteMode) => aiRewrite(selectedText!.text, mode),
    onSuccess: (r) =>
      selectedText && dispatch(editorActions.updateObjectCommit({ id: selectedText.id, patch: { text: r.text } })),
  });

  const translate = useMutation({
    mutationFn: () => aiTranslate(selectedText!.text, translateTo),
    onSuccess: (r) =>
      selectedText && dispatch(editorActions.updateObjectCommit({ id: selectedText.id, patch: { text: r.text } })),
  });

  const paletteM = useMutation({
    mutationFn: () => aiPalette(palettePrompt),
    onSuccess: (r) => setPalette(r.colors),
  });

  const fonts = useMutation({ mutationFn: () => aiFonts(fontKeyword) });

  const a11y = useMutation({
    mutationFn: () => aiAccessibility(doc),
    onSuccess: (r) => setReport(r),
  });

  const image = useMutation({
    mutationFn: () => aiGenerateImage(imagePrompt, 768, 768),
    onSuccess: (r) =>
      dispatch(editorActions.addObject(makeImage(r.url, { x: 120, y: 120, width: 384, height: 384, name: 'AI image' }))),
  });

  const applyColor = (color: string) => {
    if (selected) dispatch(editorActions.updateObjectCommit({ id: selected.id, patch: { fill: color } as never }));
    else dispatch(editorActions.setBackground(color));
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b px-3 py-2 text-sm font-semibold">AI Studio</div>

      <Section icon={Wand2} title="Write copy">
        <textarea
          className="w-full rounded-md border bg-background p-2 text-sm"
          rows={2}
          placeholder="Describe what to write…"
          value={writePrompt}
          onChange={(e) => setWritePrompt(e.target.value)}
        />
        <Button size="sm" className="w-full" loading={write.isPending} disabled={!writePrompt} onClick={() => write.mutate()}>
          Generate & add text
        </Button>
      </Section>

      <Section icon={Type} title="Rewrite selected text">
        {selectedText ? (
          <div className="grid grid-cols-3 gap-1">
            {(['shorten', 'expand', 'formal', 'friendly', 'fix'] as RewriteMode[]).map((m) => (
              <Button key={m} size="sm" variant="outline" loading={rewrite.isPending} onClick={() => rewrite.mutate(m)}>
                {m}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select a text layer to rewrite it.</p>
        )}
      </Section>

      <Section icon={Languages} title="Translate selected text">
        <div className="flex gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={translateTo}
            onChange={(e) => setTranslateTo(e.target.value)}
          >
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
          <Button size="sm" className="flex-1" disabled={!selectedText} loading={translate.isPending} onClick={() => translate.mutate()}>
            Translate
          </Button>
        </div>
      </Section>

      <Section icon={Palette} title="Colour palette">
        <div className="flex gap-2">
          <Input placeholder="calm ocean sunrise" value={palettePrompt} onChange={(e) => setPalettePrompt(e.target.value)} />
          <Button size="sm" loading={paletteM.isPending} disabled={!palettePrompt} onClick={() => paletteM.mutate()}>
            Go
          </Button>
        </div>
        {palette.length > 0 && (
          <div className="flex gap-1">
            {palette.map((c) => (
              <button
                key={c}
                title={`Apply ${c}`}
                onClick={() => applyColor(c)}
                className="h-8 flex-1 rounded border"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section icon={Sparkles} title="Font pairing">
        <div className="flex gap-2">
          <Input placeholder="wedding invitation" value={fontKeyword} onChange={(e) => setFontKeyword(e.target.value)} />
          <Button size="sm" loading={fonts.isPending} disabled={!fontKeyword} onClick={() => fonts.mutate()}>
            Suggest
          </Button>
        </div>
        {fonts.data?.pairings.map((p) => (
          <button
            key={p.heading}
            onClick={() => selectedText && dispatch(editorActions.updateObjectCommit({ id: selectedText.id, patch: { fontFamily: p.heading } as never }))}
            className="w-full rounded border p-2 text-left text-xs hover:bg-accent"
          >
            <span className="font-semibold">{p.heading}</span> + {p.body}
            <span className="block text-[10px] text-muted-foreground">{p.vibe}</span>
          </button>
        ))}
      </Section>

      <Section icon={ImagePlus} title="Generate image">
        <textarea
          className="w-full rounded-md border bg-background p-2 text-sm"
          rows={2}
          placeholder="a neon city skyline…"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
        />
        <Button size="sm" className="w-full" loading={image.isPending} disabled={!imagePrompt} onClick={() => image.mutate()}>
          Generate & insert
        </Button>
      </Section>

      <Section icon={ShieldCheck} title="Accessibility check">
        <Button size="sm" variant="outline" className="w-full" loading={a11y.isPending} onClick={() => a11y.mutate()}>
          {a11y.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run WCAG check'}
        </Button>
        {report && (
          <div className="space-y-1">
            <p className="text-xs">
              Score: <span className="font-semibold">{report.score}/100</span> ({report.passed}/{report.total} passed)
            </p>
            {report.issues.map((i, idx) => (
              <button
                key={idx}
                onClick={() => dispatch(editorActions.setSelection([i.objectId]))}
                className={`block w-full rounded border-l-2 bg-muted/50 px-2 py-1 text-left text-[11px] ${
                  i.severity === 'error' ? 'border-destructive' : 'border-amber-500'
                }`}
              >
                <span className="font-medium">{i.label}</span>: {i.detail}
              </button>
            ))}
            {report.issues.length === 0 && <p className="text-xs text-green-600">No issues found 🎉</p>}
          </div>
        )}
      </Section>
    </div>
  );
}
