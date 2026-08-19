"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginThrottleGuard = exports.LOGIN_RATE_TTL_SECONDS = exports.LOGIN_RATE_LIMIT = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const Env_1 = require("../util/Env");
/** Tentativas de login permitidas por janela, antes do 429. `0` desliga o limite. */
const LOGIN_RATE_LIMIT = () => Number.parseInt((0, Env_1.optionalEnv)("LOGIN_RATE_LIMIT", "5"), 10);
exports.LOGIN_RATE_LIMIT = LOGIN_RATE_LIMIT;
/** Tamanho da janela de contagem, em segundos. */
const LOGIN_RATE_TTL_SECONDS = () => Number.parseInt((0, Env_1.optionalEnv)("LOGIN_RATE_TTL_SECONDS", "60"), 10);
exports.LOGIN_RATE_TTL_SECONDS = LOGIN_RATE_TTL_SECONDS;
/**
 * Limita a força bruta em `POST /auth/login`.
 *
 * A chave combina IP de origem e e-mail tentado: atrás do Caddy todos os pedidos chegam
 * com o mesmo IP de rede (o `trust proxy` do Express recupera o real via
 * `X-Forwarded-For`), então contar só por IP puniria a loja inteira; contar só por
 * e-mail deixaria um atacante trancar a conta de um gerente. Com as duas partes juntas,
 * quem erra a senha de uma conta a partir de um ponto só é quem fica de castigo.
 *
 * O contador é em memória, isto é, por processo — suficiente para o deploy de instância
 * única descrito no DEPLOY.md.
 */
let LoginThrottleGuard = class LoginThrottleGuard extends throttler_1.ThrottlerGuard {
    async getTracker(req) {
        const body = (req.body ?? {});
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const ip = typeof req.ip === "string" ? req.ip : "desconhecido";
        return `${ip}|${email}`;
    }
    async throwThrottlingException(_context, _detail) {
        // O corpo segue o formato `{ statusCode, message }` do ErrorFilter — é o que o
        // cliente HTTP do frontend lê para mostrar a mensagem; o `ThrottlerException` padrão
        // responde só com a string solta.
        throw new common_1.HttpException({
            statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
            message: "Muitas tentativas de login. Tente novamente em instantes.",
        }, common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
};
exports.LoginThrottleGuard = LoginThrottleGuard;
exports.LoginThrottleGuard = LoginThrottleGuard = __decorate([
    (0, common_1.Injectable)()
], LoginThrottleGuard);
//# sourceMappingURL=LoginThrottleGuard.js.map