import type { ReportScan } from "../../api/types";

interface ReportScanListProps {
  title: string;
  emptyLabel: string;
  scans: readonly ReportScan[];
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Bipagens listadas uma a uma — nunca agrupadas (US-007.EC-1). */
export function ReportScanList({ title, emptyLabel, scans }: ReportScanListProps) {
  return (
    <section>
      <h2 className="section-label text-choc-600">{title}</h2>
      {scans.length === 0 ? (
        <p className="mt-2 text-item text-choc-600">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {scans.map((scan) => (
            <li key={scan.scanEventId} className="rounded-card bg-surface p-4 shadow-sm">
              <p className="text-item font-semibold text-text">
                {scan.description ?? `Código ${scan.scannedCode}`}
              </p>
              <p className="mt-1 text-meta text-choc-600">
                {scan.scannedCode} · {formatTime(scan.scannedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
