/**
 * CPF do cadastro de usuário (US-004).
 *
 * A validação é local, sem dependência nova: o algoritmo de dígito verificador é
 * pequeno o bastante para não justificar uma biblioteca (TechSpec, Key Decisions).
 * Sequências de dígito repetido (`11111111111`) passam no checksum mas são recusadas
 * na prática, então também são rejeitadas aqui (US-004.EC-1).
 */

const INVALID = "CPF inválido";

/** Dígito verificador da posição `position` (10 para o primeiro, 11 para o segundo). */
const checkDigit = (digits: string, position: number): number => {
  const sum = digits
    .slice(0, position - 1)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (position - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
};

const hasValidCheckDigits = (digits: string): boolean =>
  checkDigit(digits, 10) === Number(digits[9]) && checkDigit(digits, 11) === Number(digits[10]);

export default class Cpf {
  private constructor(readonly digits: string) {}

  /** Aceita com ou sem pontuação; guarda apenas os 11 dígitos. */
  static create(raw: string): Cpf {
    const digits = raw.replace(/\D/g, "");
    const allSameDigit = /^(\d)\1{10}$/.test(digits);
    if (digits.length !== 11 || allSameDigit || !hasValidCheckDigits(digits)) {
      throw new Error(INVALID);
    }
    return new Cpf(digits);
  }
}
