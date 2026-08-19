"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
/** Entrega o usuário que o `AuthGuard` anexou à requisição. */
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, context) => context.switchToHttp().getRequest().user);
//# sourceMappingURL=CurrentUser.js.map