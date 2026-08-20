"use strict";
/**
 * Senha inicial previsível `CPF@DDMMAAAA` (ADR-002).
 *
 * Fica isolada porque três caminhos precisam produzir exatamente o mesmo valor:
 * o cadastro (`CreateUser`), o reset (`ResetPassword`) e a recusa de "senha nova igual
 * à inicial" (`ChangeInitialPassword`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialPasswordFor = void 0;
/** `cpfDigits` só com dígitos; `birthDate` no formato `YYYY-MM-DD` do Postgres. */
const initialPasswordFor = (cpfDigits, birthDate) => {
    const [year, month, day] = birthDate.split("-");
    if (year === undefined || month === undefined || day === undefined) {
        throw new Error("Data de nascimento inválida");
    }
    return `${cpfDigits}@${day}${month}${year}`;
};
exports.initialPasswordFor = initialPasswordFor;
//# sourceMappingURL=InitialPassword.js.map