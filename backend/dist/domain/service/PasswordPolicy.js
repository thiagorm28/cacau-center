"use strict";
/**
 * Política mínima de senha (TechSpec, Key Decisions): 8 caracteres e ao menos um
 * dígito — equilíbrio entre segurança e a fricção de digitar no celular em loja.
 *
 * Compartilhada entre a troca obrigatória (`ChangeInitialPassword`) e o
 * provisionamento do admin (`scripts/bootstrap-admin.ts`), para que as duas portas de
 * entrada de senha nunca divirjam.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPasswordPolicy = exports.MIN_PASSWORD_LENGTH = void 0;
exports.MIN_PASSWORD_LENGTH = 8;
const assertPasswordPolicy = (password) => {
    if (password.length < exports.MIN_PASSWORD_LENGTH) {
        throw new Error(`A senha deve ter ao menos ${exports.MIN_PASSWORD_LENGTH} caracteres`);
    }
    if (!/\d/.test(password))
        throw new Error("A senha deve conter ao menos um dígito");
};
exports.assertPasswordPolicy = assertPasswordPolicy;
//# sourceMappingURL=PasswordPolicy.js.map