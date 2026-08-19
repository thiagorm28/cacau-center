import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, getNoteReport } from "../api/client";
import type { DivergenceReport } from "../api/types";
import { Banner } from "../components/ui/Banner";
import { Screen } from "../components/ui/Screen";
import { ReportScreen } from "../features/report/ReportScreen";

export function ReportRoute() {
  const { noteId = "" } = useParams();
  const [report, setReport] = useState<DivergenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getNoteReport(noteId)
      .then((loaded) => {
        if (active) setReport(loaded);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        // 409: a nota ainda está em conferência, sem relatório final (US-017.EC-2).
        setError(
          cause instanceof ApiError && cause.status === 409
            ? "Esta conferência ainda está em andamento."
            : "Não foi possível carregar o relatório.",
        );
      });
    return () => {
      active = false;
    };
  }, [noteId]);

  if (error !== null) {
    return (
      <Screen title="Relatório">
        <Banner tone="info">{error}</Banner>
      </Screen>
    );
  }
  if (report === null) return <Screen title="Relatório">{null}</Screen>;
  return <ReportScreen report={report} />;
}
