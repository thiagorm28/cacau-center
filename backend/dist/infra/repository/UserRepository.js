"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../database/schema");
const toRecord = (row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
});
class UserRepositoryDatabase {
    constructor(exec) {
        this.exec = exec;
    }
    async findByEmail(email) {
        const [row] = await this.exec.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email)).limit(1);
        return row === undefined ? null : toRecord(row);
    }
    async findById(userId) {
        const [row] = await this.exec.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        return row === undefined ? null : toRecord(row);
    }
    async findByIds(userIds) {
        if (userIds.length === 0)
            return [];
        const rows = await this.exec
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.inArray)(schema_1.users.id, [...userIds]));
        return rows.map(toRecord);
    }
}
exports.default = UserRepositoryDatabase;
//# sourceMappingURL=UserRepository.js.map