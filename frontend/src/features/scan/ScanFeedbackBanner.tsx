import { Banner } from "../../components/ui/Banner";
import type { ScanFeedback } from "./useScanSession";

interface ScanFeedbackBannerProps {
  feedback: ScanFeedback | null;
}

/** Retorno imediato da última leitura, calculado localmente por `resolveScan`. */
export function ScanFeedbackBanner({ feedback }: ScanFeedbackBannerProps) {
  if (feedback === null) return null;
  if (feedback.kind === "matched") {
    return <Banner tone="success">{`Confirmado: ${feedback.description}`}</Banner>;
  }
  if (feedback.kind === "exceeded") {
    return (
      <Banner tone="warning">
        {`Quantidade já atingida para ${feedback.description}. A caixa entra como excedente no relatório.`}
      </Banner>
    );
  }
  return <Banner tone="warning">{`Código não reconhecido: ${feedback.description}`}</Banner>;
}
