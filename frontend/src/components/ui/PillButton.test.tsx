import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PillButton } from "./PillButton";

describe("PillButton", () => {
  it("UT-024: a variante 'danger' usa o mesmo tom do Banner de erro", () => {
    render(<PillButton variant="danger">Excluir</PillButton>);

    const button = screen.getByRole("button", { name: "Excluir" });
    expect(button.className).toContain("bg-choc-700");
    expect(button.className).toContain("text-cream-1");
    expect(button.className).toContain("rounded-pill");
  });
});
