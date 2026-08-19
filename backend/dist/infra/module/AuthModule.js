"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const throttler_1 = require("@nestjs/throttler");
const Login_1 = __importDefault(require("../../application/usecase/Login"));
const SessionUser_1 = require("../../domain/SessionUser");
const JwtStrategy_1 = require("../auth/JwtStrategy");
const TokenGenerator_1 = __importDefault(require("../auth/TokenGenerator"));
const AuthController_1 = require("../controller/AuthController");
const LoginThrottleGuard_1 = require("../guard/LoginThrottleGuard");
const PasswordHasher_1 = __importDefault(require("../util/PasswordHasher"));
const Env_1 = require("../util/Env");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Único consumidor do throttler: o guard só é aplicado em `POST /auth/login`.
            throttler_1.ThrottlerModule.forRootAsync({
                useFactory: () => [
                    {
                        name: "login",
                        limit: (0, LoginThrottleGuard_1.LOGIN_RATE_LIMIT)(),
                        ttl: (0, LoginThrottleGuard_1.LOGIN_RATE_TTL_SECONDS)() * 1000,
                        // `LOGIN_RATE_LIMIT=0` desliga o freio (usado por suítes que fazem muitos
                        // logins seguidos); sem isto o limite zero barraria toda tentativa.
                        skipIf: () => (0, LoginThrottleGuard_1.LOGIN_RATE_LIMIT)() <= 0,
                    },
                ],
            }),
            passport_1.PassportModule.register({ defaultStrategy: "jwt", session: false }),
            jwt_1.JwtModule.registerAsync({
                useFactory: () => ({
                    secret: (0, Env_1.requireEnv)("JWT_SECRET"),
                    signOptions: { expiresIn: SessionUser_1.SESSION_TTL_SECONDS },
                }),
            }),
        ],
        controllers: [AuthController_1.AuthController],
        providers: [
            Login_1.default,
            LoginThrottleGuard_1.LoginThrottleGuard,
            { provide: "PasswordHasher", useFactory: () => new PasswordHasher_1.default() },
            {
                provide: "TokenGenerator",
                useFactory: (jwtService) => new TokenGenerator_1.default(jwtService),
                inject: [jwt_1.JwtService],
            },
            { provide: JwtStrategy_1.JwtStrategy, useFactory: () => new JwtStrategy_1.JwtStrategy((0, Env_1.requireEnv)("JWT_SECRET")) },
        ],
        exports: ["PasswordHasher"],
    })
], AuthModule);
//# sourceMappingURL=AuthModule.js.map