import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  tone?: "surface" | "chocolate";
}

/** Cartão creme com raio `22px` e sombra `md` (DESIGN.md). */
export function Card({ children, onClick, tone = "surface" }: CardProps) {
  const palette =
    tone === "chocolate" ? "bg-choc-800 text-cream-1" : "bg-surface text-text";
  const className = `rounded-card ${palette} p-5 shadow-md`;
  if (onClick === undefined) return <div className={className}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={`${className} w-full text-left`}>
      {children}
    </button>
  );
}
