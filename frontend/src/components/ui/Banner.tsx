import type { ReactNode } from "react";

export type BannerTone = "info" | "success" | "warning" | "error";

interface BannerProps {
  tone: BannerTone;
  children: ReactNode;
}

const TONES: Record<BannerTone, string> = {
  info: "bg-accent-100 text-accent-700",
  success: "bg-accent-100 text-accent-900",
  warning: "bg-accent-300 text-accent-900",
  error: "bg-choc-700 text-cream-1",
};

/** Mensagem contextual em pílula; texto sempre no passo 700/900 do acento. */
export function Banner({ tone, children }: BannerProps) {
  return (
    <p role="status" className={`rounded-pill px-5 py-3 text-item font-medium ${TONES[tone]}`}>
      {children}
    </p>
  );
}
