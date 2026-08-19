import type { ReactNode } from "react";

export type PillButtonVariant = "primary" | "secondary" | "ghost";

interface PillButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: PillButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
}

/** Raio `999px` (pílula) conforme `DESIGN.md` — nenhum canto reto. */
const VARIANTS: Record<PillButtonVariant, string> = {
  primary: "bg-accent text-surface shadow-md hover:bg-accent-700",
  secondary: "bg-accent-100 text-accent-700 shadow-sm hover:bg-accent-300",
  ghost: "bg-transparent text-choc-700 hover:bg-accent-100",
};

export function PillButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  fullWidth = false,
}: PillButtonProps) {
  return (
    <button
      type={type === "submit" ? "submit" : "button"}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-pill px-6 py-3 font-body text-item font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${fullWidth ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}
