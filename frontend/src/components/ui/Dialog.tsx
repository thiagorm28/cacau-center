import type { ReactNode } from "react";

interface DialogProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Folha modal ancorada na base, com o raio de folha (`34px 34px 0 0`). */
export function Dialog({ title, description, children }: DialogProps) {
  return (
    <div className="fixed inset-0 z-10 flex items-end bg-choc-800/60">
      <div role="dialog" aria-label={title} className="w-full rounded-t-sheet bg-surface p-6 shadow-lg">
        <h2 className="font-heading text-title text-choc-800">{title}</h2>
        {description === undefined ? null : (
          <p className="mt-2 text-item text-choc-600">{description}</p>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
