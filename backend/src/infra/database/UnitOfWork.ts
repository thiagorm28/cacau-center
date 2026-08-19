import { Inject, Injectable } from "@nestjs/common";
import NoteRepositoryDatabase, { type NoteRepository } from "../repository/NoteRepository";
import ScanEventRepositoryDatabase, {
  type ScanEventRepository,
} from "../repository/ScanEventRepository";
import UserRepositoryDatabase, { type UserRepository } from "../repository/UserRepository";
import type { DatabaseConnection, Executor } from "./DatabaseConnection";

export type Repositories = {
  notes: NoteRepository;
  scanEvents: ScanEventRepository;
  users: UserRepository;
};

/**
 * Unidade de trabalho transacional.
 *
 * Existe porque o caminho de alocação (`ApplyScanEvent`/`SyncScanEvents`) lê o estado das
 * notas abertas e escreve com base nessa leitura: `drizzle-orm-conventions` exige que
 * leitura e escrita fiquem na mesma `db.transaction`. Os casos de uso recebem os
 * repositórios já ligados à transação, sem conhecer o Drizzle.
 */
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

const bind = (exec: Executor): Repositories => ({
  notes: new NoteRepositoryDatabase(exec),
  scanEvents: new ScanEventRepositoryDatabase(exec),
  users: new UserRepositoryDatabase(exec),
});

@Injectable()
export default class UnitOfWorkDatabase implements UnitOfWork {
  constructor(@Inject("DatabaseConnection") private readonly connection: DatabaseConnection) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return this.connection.getDb().transaction((tx) => work(bind(tx)));
  }
}
