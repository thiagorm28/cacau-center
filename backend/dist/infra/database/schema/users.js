"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.userRole = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.userRole = (0, pg_core_1.pgEnum)("user_role", ["operador", "gerente", "admin"]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    /** Somente dígitos (11 caracteres); a validação de formato mora em `Cpf`. */
    cpf: (0, pg_core_1.text)("cpf").notNull().unique(),
    birthDate: (0, pg_core_1.date)("birth_date").notNull(),
    passwordHash: (0, pg_core_1.text)("password_hash").notNull(),
    role: (0, exports.userRole)("role").notNull(),
    /** Desativação lógica (ADR-003): a linha nunca é excluída, preservando o histórico. */
    active: (0, pg_core_1.boolean)("active").notNull().default(true),
    /** Troca obrigatória de senha pendente (ADR-002). */
    mustChangePassword: (0, pg_core_1.boolean)("must_change_password").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=users.js.map