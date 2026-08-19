"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Roles = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = "roles";
/** Restringe a rota aos papéis informados; sem o decorator, qualquer papel autenticado passa. */
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
//# sourceMappingURL=Roles.js.map