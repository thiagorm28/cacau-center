/**
 * Política mínima de senha (TechSpec, Key Decisions): 8 caracteres e ao menos um
 * dígito — equilíbrio entre segurança e a fricção de digitar no celular em loja.
 *
 * Compartilhada entre a troca obrigatória (`ChangeInitialPassword`) e o
 * provisionamento do admin (`scripts/bootstrap-admin.ts`), para que as duas portas de
 * entrada de senha nunca divirjam.
 */

export const MIN_PASSWORD_LENGTH = 8;

export const assertPasswordPolicy = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (!/\d/.test(password)) throw new Error("A senha deve conter ao menos um dígito");
};
