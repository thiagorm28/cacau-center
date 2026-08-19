import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildReport } from "../../test/fixtures";
import { ReportScreen } from "./ReportScreen";

const missingItem = {
  itemId: "item-1",
  cProd: "1001",
  description: "Panetone Trufado 400g",
  unit: "CX",
  expectedQty: 10,
  confirmedQty: 7,
  missingQty: 3,
};

describe("ReportScreen", () => {
  it("UT-063: renderiza a lista de itens faltantes de uma nota closed_incomplete", () => {
    const report = buildReport({
      status: "closed_incomplete",
      items: [missingItem],
      missingItems: [missingItem],
    });

    render(<ReportScreen report={report} />);

    expect(screen.getByText("Itens faltantes")).toBeInTheDocument();
    expect(screen.getByText("Panetone Trufado 400g")).toBeInTheDocument();
    expect(screen.getByText("Faltam 3 de 10 CX")).toBeInTheDocument();
  });

  it("UT-064: renderiza a confirmação 'tudo certo' para nota completa", () => {
    const report = buildReport({ status: "completed", isComplete: true });

    render(<ReportScreen report={report} />);

    expect(screen.getByText(/Tudo certo/)).toBeInTheDocument();
    expect(screen.getByText("Nenhum item faltante.")).toBeInTheDocument();
  });

  it("UT-065: lista itens com excedente separadamente dos faltantes", () => {
    const report = buildReport({
      status: "closed_incomplete",
      items: [missingItem],
      missingItems: [missingItem],
      exceededScans: [
        {
          scanEventId: "scan-1",
          scannedCode: "1001",
          scannedAt: "2026-08-17T11:30:00.000Z",
          itemId: "item-1",
          description: "Panetone Trufado 400g",
        },
      ],
    });

    render(<ReportScreen report={report} />);

    const exceeded = screen.getByRole("heading", { name: "Caixas excedentes" });
    const section = exceeded.closest("section");
    expect(section).not.toBeNull();
    expect(section?.querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByText(/^1001 ·/)).toBeInTheDocument();
    expect(screen.getByText("Faltam 3 de 10 CX")).toBeInTheDocument();
  });
});
