import type { DivergenceReport } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { Screen } from "../../components/ui/Screen";
import { ReportScanList } from "./ReportScanList";

interface ReportScreenProps {
  report: DivergenceReport;
}

const STATUS_LABEL: Record<DivergenceReport["status"], string> = {
  open: "Em conferência",
  completed: "Conferência completa",
  closed_incomplete: "Finalizada com divergência",
};

/** Relatório final da nota: faltantes, excedentes e caixas não identificadas (US-012). */
export function ReportScreen({ report }: ReportScreenProps) {
  const hasNoDivergence =
    report.missingItems.length === 0 &&
    report.exceededScans.length === 0 &&
    report.unidentifiedScans.length === 0;

  return (
    <Screen
      title={`Nota ${report.invoiceNumber}`}
      subtitle={STATUS_LABEL[report.status]}
    >
      <div className="flex flex-col gap-6">
        {report.isComplete && hasNoDivergence ? (
          <Banner tone="success">Tudo certo: todos os itens foram conferidos.</Banner>
        ) : null}

        <section>
          <h2 className="section-label text-choc-600">Itens faltantes</h2>
          {report.missingItems.length === 0 ? (
            <p className="mt-2 text-item text-choc-600">Nenhum item faltante.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {report.missingItems.map((item) => (
                <li key={item.itemId} className="rounded-card bg-surface p-4 shadow-sm">
                  <p className="text-item font-semibold text-text">{item.description}</p>
                  <p className="mt-1 text-meta text-accent-700">
                    Faltam {item.missingQty} de {item.expectedQty} {item.unit}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ReportScanList
          title="Caixas excedentes"
          emptyLabel="Nenhuma caixa excedente."
          scans={report.exceededScans}
        />
        <ReportScanList
          title="Caixas não identificadas"
          emptyLabel="Nenhuma caixa não identificada."
          scans={report.unidentifiedScans}
        />
      </div>
    </Screen>
  );
}
