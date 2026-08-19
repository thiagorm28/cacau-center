"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.userRole = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.userRole = (0, pg_core_1.pgEnum)("user_role", ["operador", "gerente"]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    passwordHash: (0, pg_core_1.text)("password_hash").notNull(),
    role: (0, exports.userRole)("role").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=users.js.map