/**
 * Senha inicial previsível `CPF@DDMMAAAA` (ADR-002).
 *
 * Fica isolada porque três caminhos precisam produzir exatamente o mesmo valor:
 * o cadastro (`CreateUser`), o reset (`ResetPassword`) e a recusa de "senha nova igual
 * à inicial" (`ChangeInitialPassword`).
 */

/** `cpfDigits` só com dígitos; `birthDate` no formato `YYYY-MM-DD` do Postgres. */
export const initialPasswordFor = (cpfDigits: string, birthDate: string): string => {
  const [year, month, day] = birthDate.split("-");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Data de nascimento inválida");
  }
  return `${cpfDigits}@${day}${month}${year}`;
};
