import { Module } from "@nestjs/common";
import CreateUser from "../../application/usecase/CreateUser";
import DeactivateUser from "../../application/usecase/DeactivateUser";
import ListUsers from "../../application/usecase/ListUsers";
import ReactivateUser from "../../application/usecase/ReactivateUser";
import ResetPassword from "../../application/usecase/ResetPassword";
import UpdateUser from "../../application/usecase/UpdateUser";
import { UserController } from "../controller/UserController";
import { AuthModule } from "./AuthModule";

/** `AuthModule` entrega o `PasswordHasher` e o `SessionRevocationStore` (singleton). */
@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [ListUsers, CreateUser, UpdateUser, DeactivateUser, ReactivateUser, ResetPassword],
})
export class UserModule {}
