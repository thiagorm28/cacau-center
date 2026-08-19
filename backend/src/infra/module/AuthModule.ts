import { Module } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";
import Login from "../../application/usecase/Login";
import { SESSION_TTL_SECONDS } from "../../domain/SessionUser";
import { JwtStrategy } from "../auth/JwtStrategy";
import TokenGeneratorJwt from "../auth/TokenGenerator";
import { AuthController } from "../controller/AuthController";
import {
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_TTL_SECONDS,
  LoginThrottleGuard,
} from "../guard/LoginThrottleGuard";
import PasswordHasherBcrypt from "../util/PasswordHasher";
import { requireEnv } from "../util/Env";

@Module({
  imports: [
    // Único consumidor do throttler: o guard só é aplicado em `POST /auth/login`.
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          name: "login",
          limit: LOGIN_RATE_LIMIT(),
          ttl: LOGIN_RATE_TTL_SECONDS() * 1000,
          // `LOGIN_RATE_LIMIT=0` desliga o freio (usado por suítes que fazem muitos
          // logins seguidos); sem isto o limite zero barraria toda tentativa.
          skipIf: () => LOGIN_RATE_LIMIT() <= 0,
        },
      ],
    }),
    PassportModule.register({ defaultStrategy: "jwt", session: false }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requireEnv("JWT_SECRET"),
        signOptions: { expiresIn: SESSION_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    Login,
    LoginThrottleGuard,
    { provide: "PasswordHasher", useFactory: () => new PasswordHasherBcrypt() },
    {
      provide: "TokenGenerator",
      useFactory: (jwtService: JwtService) => new TokenGeneratorJwt(jwtService),
      inject: [JwtService],
    },
    { provide: JwtStrategy, useFactory: () => new JwtStrategy(requireEnv("JWT_SECRET")) },
  ],
  exports: ["PasswordHasher"],
})
export class AuthModule {}
