"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRevocationStore = void 0;
const common_1 = require("@nestjs/common");
/**
 * Corte imediato de acesso para contas desativadas (ADR-005).
 *
 * Singleton do processo Nest: guarda o instante da revogação por usuário e compara com
 * o `iat` do JWT apresentado. Reativar não precisa limpar nada — um token emitido
 * depois da revogação já tem `iat` posterior e passa naturalmente.
 *
 * Risco aceito em ADR-005: o estado vive só na memória do processo e não sobrevive a um
 * restart do backend.
 */
let SessionRevocationStore = class SessionRevocationStore {
    constructor() {
        this.revokedAtMs = new Map();
    }
    revoke(userId) {
        this.revokedAtMs.set(userId, Date.now());
    }
    isRevoked(userId, tokenIssuedAtSeconds) {
        const revokedAt = this.revokedAtMs.get(userId);
        return revokedAt !== undefined && tokenIssuedAtSeconds * 1000 < revokedAt;
    }
};
exports.SessionRevocationStore = SessionRevocationStore;
exports.SessionRevocationStore = SessionRevocationStore = __decorate([
    (0, common_1.Injectable)()
], SessionRevocationStore);
//# sourceMappingURL=SessionRevocationStore.js.map