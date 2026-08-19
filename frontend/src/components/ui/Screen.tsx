import type { ReactNode } from "react";

interface ScreenProps {
  title: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
}

/**
 * Layout base: cabeçalho em chocolate e a folha creme com cantos `34px 34px 0 0`
 * sobrepondo levemente o cabeçalho, alinhada à esquerda (DESIGN.md — Princípios).
 */
export function Screen({ title, subtitle, header, children }: ScreenProps) {
  return (
    <div className="min-h-dvh bg-choc-800">
      <header className="px-6 pt-10 pb-12">
        <h1 className="font-heading text-title text-cream-1">{title}</h1>
        {subtitle === undefined ? null : (
          <p className="mt-1 text-meta text-cream-3">{subtitle}</p>
        )}
        {header}
      </header>
      <main className="-mt-6 min-h-[70dvh] rounded-t-sheet bg-bg px-6 pt-8 pb-16">
        {children}
      </main>
    </div>
  );
}
