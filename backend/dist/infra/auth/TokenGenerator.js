"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const SessionUser_1 = require("../../domain/SessionUser");
let TokenGeneratorJwt = class TokenGeneratorJwt {
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    generate(user) {
        const payload = {
            sub: user.userId,
            name: user.name,
            email: user.email,
            role: user.role,
        };
        return this.jwtService.signAsync(payload, { expiresIn: SessionUser_1.SESSION_TTL_SECONDS });
    }
    ttlInSeconds() {
        return SessionUser_1.SESSION_TTL_SECONDS;
    }
};
TokenGeneratorJwt = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Function])
], TokenGeneratorJwt);
exports.default = TokenGeneratorJwt;
//# sourceMappingURL=TokenGenerator.js.map