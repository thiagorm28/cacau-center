import { Body, Controller, Get, HttpCode, Inject, Post, Res, UseGuards } from "@nestjs/common";
import type { CookieOptions, Response } from "express";
import Login from "../../application/usecase/Login";
import type { SessionUser } from "../../domain/SessionUser";
import { SESSION_COOKIE } from "../auth/JwtStrategy";
import { LoginThrottleGuard } from "../guard/LoginThrottleGuard";
import { Public } from "../guard/Public";
import { CurrentUser } from "./CurrentUser";
import { LoginDto } from "./dto/AuthDto";

/** Cookie de sessão conforme ADR-009: inacessível a JavaScript, só sobre TLS. */
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};

@Controller("auth")
export class AuthController {
  constructor(@Inject(Login) private readonly login: Login) {}

  /** Rota pública e sensível: o throttle freia adivinhação de senha (ver ADR-009). */
  @Public()
  @UseGuards(LoginThrottleGuard)
  @Post("login")
  @HttpCode(200)
  async signIn(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const output = await this.login.execute({ email: body.email, password: body.password });
    response.cookie(SESSION_COOKIE, output.token, {
      ...COOKIE_OPTIONS,
      maxAge: output.ttlInSeconds * 1000,
    });
    return { id: output.user.userId, name: output.user.name, role: output.user.role };
  }

  @Post("logout")
  @HttpCode(204)
  signOut(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
  }

  @Get("me")
  me(@CurrentUser() user: SessionUser) {
    return { id: user.userId, name: user.name, role: user.role };
  }
}
