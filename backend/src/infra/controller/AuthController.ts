import { Body, Controller, Get, HttpCode, Inject, Post, Res, UseGuards } from "@nestjs/common";
import type { CookieOptions, Response } from "express";
import ChangeInitialPassword from "../../application/usecase/ChangeInitialPassword";
import Login from "../../application/usecase/Login";
import type { SessionUser } from "../../domain/SessionUser";
import { SESSION_COOKIE } from "../auth/JwtStrategy";
import type { TokenGenerator } from "../auth/TokenGenerator";
import { AllowPendingPasswordChange } from "../guard/AllowPendingPasswordChange";
import { LoginThrottleGuard } from "../guard/LoginThrottleGuard";
import { Public } from "../guard/Public";
import { CurrentUser } from "./CurrentUser";
import { LoginDto } from "./dto/AuthDto";
import { ChangePasswordDto } from "./dto/UserDto";

/** Cookie de sessão conforme ADR-009: inacessível a JavaScript, só sobre TLS. */
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(Login) private readonly login: Login,
    @Inject(ChangeInitialPassword)
    private readonly changeInitialPassword: ChangeInitialPassword,
    @Inject("TokenGenerator") private readonly tokenGenerator: TokenGenerator,
  ) {}

  /** Rota pública e sensível: o throttle freia adivinhação de senha (ver ADR-009). */
  @Public()
  @UseGuards(LoginThrottleGuard)
  @Post("login")
  @HttpCode(200)
  async signIn(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const output = await this.login.execute({ email: body.email, password: body.password });
    this.issueSession(response, output.token, output.ttlInSeconds);
    return AuthController.identity(output.user);
  }

  @AllowPendingPasswordChange()
  @Post("logout")
  @HttpCode(204)
  signOut(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
  }

  @AllowPendingPasswordChange()
  @Get("me")
  me(@CurrentUser() user: SessionUser) {
    return AuthController.identity(user);
  }

  /**
   * Única rota de escrita liberada com a troca pendente (ADR-002): completa a troca e
   * reemite o cookie com um JWT novo, já sem a pendência — sem isso o usuário
   * continuaria barrado pelo `PasswordChangeGuard` até relogar.
   */
  @AllowPendingPasswordChange()
  @Post("change-password")
  @HttpCode(200)
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.changeInitialPassword.execute({
      userId: user.userId,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
    });
    const refreshed: SessionUser = { ...user, mustChangePassword: false };
    this.issueSession(
      response,
      await this.tokenGenerator.generate(refreshed),
      this.tokenGenerator.ttlInSeconds(),
    );
    return AuthController.identity(refreshed);
  }

  private issueSession(response: Response, token: string, ttlInSeconds: number): void {
    response.cookie(SESSION_COOKIE, token, {
      ...COOKIE_OPTIONS,
      maxAge: ttlInSeconds * 1000,
    });
  }

  private static identity(user: SessionUser) {
    return {
      id: user.userId,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
