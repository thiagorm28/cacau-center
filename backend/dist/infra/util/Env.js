"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalEnv = exports.requireEnv = exports.DEFAULT_NFE_BASE_URL = void 0;
/** Base pública da API interna da Cacau Show (ADR-011); sobrescrevível para fixtures. */
exports.DEFAULT_NFE_BASE_URL = "http://hybrisreports.cacaushow.com.br";
const requireEnv = (name) => {
    const value = process.env[name];
    if (value === undefined || value.trim() === "") {
        throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
    return value;
};
exports.requireEnv = requireEnv;
const optionalEnv = (name, fallback) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "" ? fallback : value;
};
exports.optionalEnv = optionalEnv;
//# sourceMappingURL=Env.js.map