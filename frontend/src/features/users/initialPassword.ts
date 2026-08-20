/**
 * Senha inicial `CPF@DDMMAAAA` (ADR-002), espelhando `domain/service/InitialPassword.ts`
 * do backend. A tela precisa dela porque a comunicação da credencial ao funcionário é
 * manual (PRD — "Fluxos principais" 1 e 4): sem exibi-la, o admin cadastra alguém que
 * ninguém consegue acessar. O valor não é enviado nem conferido aqui — quem define e
 * valida a senha continua sendo o backend.
 */
export const initialPasswordFor = (cpf: string, birthDate: string): string => {
  const digits = cpf.replace(/\D/g, "");
  const [year, month, day] = birthDate.split("-");
  if (year === undefined || month === undefined || day === undefined) return digits;
  return `${digits}@${day}${month}${year}`;
};
