import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import CreateUser from "../../application/usecase/CreateUser";
import DeactivateUser from "../../application/usecase/DeactivateUser";
import ListUsers from "../../application/usecase/ListUsers";
import ReactivateUser from "../../application/usecase/ReactivateUser";
import ResetPassword from "../../application/usecase/ResetPassword";
import UpdateUser from "../../application/usecase/UpdateUser";
import { NotFoundError } from "../../domain/error/DomainErrors";
import { Roles } from "../guard/Roles";
import { CreateUserDto, UpdateUserDto } from "./dto/UserDto";

/** Um id fora do formato UUID nunca corresponde a um usuário — responde 404, não 400. */
const userIdParam = () =>
  new ParseUUIDPipe({ exceptionFactory: () => new NotFoundError("Usuário não encontrado") });

/**
 * Gestão de contas: exclusiva do admin (US-012). Basta `@Roles("admin")` no controller —
 * o bypass de admin do `RoleGuard` (ADR-006) só afrouxa rotas de outros papéis, e
 * operador/gerente continuam recusados aqui.
 */
@Roles("admin")
@Controller("users")
export class UserController {
  constructor(
    @Inject(ListUsers) private readonly listUsers: ListUsers,
    @Inject(CreateUser) private readonly createUser: CreateUser,
    @Inject(UpdateUser) private readonly updateUser: UpdateUser,
    @Inject(DeactivateUser) private readonly deactivateUser: DeactivateUser,
    @Inject(ReactivateUser) private readonly reactivateUser: ReactivateUser,
    @Inject(ResetPassword) private readonly resetPassword: ResetPassword,
  ) {}

  @Get()
  list() {
    return this.listUsers.execute();
  }

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.createUser.execute({
      name: body.name,
      email: body.email,
      cpf: body.cpf,
      birthDate: body.birthDate,
      role: body.role,
    });
  }

  @Patch(":id")
  update(@Param("id", userIdParam()) id: string, @Body() body: UpdateUserDto) {
    return this.updateUser.execute({
      id,
      name: body.name,
      birthDate: body.birthDate,
      role: body.role,
    });
  }

  @Post(":id/deactivate")
  @HttpCode(200)
  deactivate(@Param("id", userIdParam()) id: string) {
    return this.deactivateUser.execute({ id });
  }

  @Post(":id/reactivate")
  @HttpCode(200)
  reactivate(@Param("id", userIdParam()) id: string) {
    return this.reactivateUser.execute({ id });
  }

  @Post(":id/reset-password")
  @HttpCode(200)
  reset(@Param("id", userIdParam()) id: string) {
    return this.resetPassword.execute({ id });
  }
}
