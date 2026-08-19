interface BigCounterProps {
  value: number;
  total: number;
  caption: string;
}

/** Número grande em Caprasimo (76px), o elemento de destaque do `DESIGN.md`. */
export function BigCounter({ value, total, caption }: BigCounterProps) {
  return (
    <div className="flex flex-col items-start">
      <p className="font-heading text-display leading-none text-cream-1">
        {value}
        <span className="text-title text-cream-3">/{total}</span>
      </p>
      <p className="section-label mt-2 text-cream-2">{caption}</p>
    </div>
  );
}
