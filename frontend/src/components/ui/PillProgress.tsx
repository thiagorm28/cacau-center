interface PillProgressProps {
  confirmed: number;
  expected: number;
  label: string;
  tone?: "light" | "dark";
}

/** Barra de progresso em pílula (`999px`), preenchida com o acento terracota. */
export function PillProgress({ confirmed, expected, label, tone = "light" }: PillProgressProps) {
  const percent = expected <= 0 ? 0 : Math.min(100, Math.round((confirmed / expected) * 100));
  const track = tone === "dark" ? "bg-choc-700" : "bg-accent-100";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={expected}
      aria-valuenow={confirmed}
      className={`h-2 w-full overflow-hidden rounded-pill ${track}`}
    >
      <div className="h-full rounded-pill bg-accent transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}
