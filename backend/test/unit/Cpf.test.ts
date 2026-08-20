import { describe, expect, it } from "vitest";
import Cpf from "../../src/domain/valueobject/Cpf";

describe("Cpf", () => {
  it("UT-001 aceita CPF válido com pontuação e guarda só os dígitos", () => {
    expect(Cpf.create("111.444.777-35").digits).toBe("11144477735");
  });

  it("UT-002 aceita o mesmo CPF sem pontuação e produz os mesmos dígitos", () => {
    expect(Cpf.create("11144477735").digits).toBe(Cpf.create("111.444.777-35").digits);
  });

  it("UT-003 recusa CPF com dígito verificador inválido", () => {
    expect(() => Cpf.create("11144477736")).toThrow("CPF inválido");
  });

  it("UT-004 recusa CPF com todos os dígitos iguais", () => {
    expect(() => Cpf.create("11111111111")).toThrow("CPF inválido");
  });

  it("UT-005 recusa CPF com comprimento inválido", () => {
    expect(() => Cpf.create("123")).toThrow("CPF inválido");
  });
});
