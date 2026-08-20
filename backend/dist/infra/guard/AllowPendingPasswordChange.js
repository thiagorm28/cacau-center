"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowPendingPasswordChange = exports.ALLOW_PENDING_PASSWORD_CHANGE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ALLOW_PENDING_PASSWORD_CHANGE_KEY = "allowPendingPasswordChange";
/**
 * Dispensa o `PasswordChangeGuard` global: a rota continua acessível a quem tem troca
 * de senha obrigatória pendente (ADR-002) — só a própria troca, o `me` e o `logout`.
 */
const AllowPendingPasswordChange = () => (0, common_1.SetMetadata)(exports.ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
exports.AllowPendingPasswordChange = AllowPendingPasswordChange;
//# sourceMappingURL=AllowPendingPasswordChange.js.map