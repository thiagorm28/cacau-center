"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../database/schema");
const toRecord = (row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    cpf: row.cpf,
    birthDate: row.birthDate,
    passwordHash: row.passwordHash,
    role: row.role,
    active: row.active,
    mustChangePassword: row.mustChangePassword,
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
    async findByCpf(cpf) {
        const [row] = await this.exec.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.cpf, cpf)).limit(1);
        return row === undefined ? null : toRecord(row);
    }
    /** Sem filtro nem paginação: o volume é de poucos funcionários por loja (TechSpec). */
    async list() {
        const rows = await this.exec.select().from(schema_1.users).orderBy(schema_1.users.name);
        return rows.map(toRecord);
    }
    async create(data) {
        const [row] = await this.exec
            .insert(schema_1.users)
            .values({
            name: data.name,
            email: data.email,
            cpf: data.cpf,
            birthDate: data.birthDate,
            passwordHash: data.passwordHash,
            role: data.role,
            active: data.active,
            mustChangePassword: data.mustChangePassword,
        })
            .returning();
        if (row === undefined)
            throw new Error("Falha ao inserir usuário");
        return toRecord(row);
    }
    async update(userId, data) {
        const [row] = await this.exec
            .update(schema_1.users)
            .set({ name: data.name, birthDate: data.birthDate, role: data.role })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        if (row === undefined)
            throw new Error("Usuário não encontrado");
        return toRecord(row);
    }
    async setActive(userId, active) {
        await this.exec.update(schema_1.users).set({ active }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    async setPassword(userId, passwordHash, mustChangePassword) {
        await this.exec.update(schema_1.users).set({ passwordHash, mustChangePassword }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
}
exports.default = UserRepositoryDatabase;
//# sourceMappingURL=UserRepository.js.map