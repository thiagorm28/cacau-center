import { Inject, Injectable } from "@nestjs/common";
import { ConflictError } from "../../domain/error/DomainErrors";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import type { NfeGateway } from "../../infra/gateway/NfeGateway";

export type Input = { invoiceNumber: string; operatorId: string };

export type Output = {
  noteId: string;
  status: "open" | "completed" | "closed_incomplete";
  items: ReadonlyArray<{
    itemId: string;
    description: string;
    expectedQty: number;
    confirmedQty: number;
  }>;
};

@Injectable()
export default class SearchNote {
  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject("NfeGateway") private readonly nfeGateway: NfeGateway,
  ) {}

  async execute(input: Input): Promise<Output> {
    const duplicated = await this.unitOfWork.run(({ notes }) =>
      notes.hasOpenWithInvoiceNumber(input.invoiceNumber),
    );
    if (duplicated) throw new ConflictError("Nota já está em conferência");
    const nfe = await this.nfeGateway.fetchByInvoiceNumber(input.invoiceNumber);
    const note = await this.unitOfWork.run(async ({ notes }) => {
      // O lock precede a checagem: sem ele, duas requisições concorrentes para o mesmo
      // número leem "não existe" antes de qualquer INSERT commitar e abrem duas notas.
      await notes.lockInvoiceNumber(input.invoiceNumber);
      // Segunda checagem dentro da transação: a chamada externa acontece fora dela e
      // outra requisição pode ter aberto a mesma nota nesse intervalo.
      if (await notes.hasOpenWithInvoiceNumber(input.invoiceNumber)) {
        throw new ConflictError("Nota já está em conferência");
      }
      return notes.create({
        invoiceNumber: input.invoiceNumber,
        nfeChaveAcesso: nfe.chaveAcesso,
        nfeNumero: nfe.numeroNota,
        supplierCnpj: nfe.fornecedorCnpj,
        supplierName: nfe.fornecedorNome,
        rawXml: nfe.rawXml,
        openedBy: input.operatorId,
        items: nfe.items.map((item) => ({
          cProd: item.cProd,
          cEan: item.cEan,
          description: item.descricao,
          unit: item.unidade,
          expectedQty: item.quantidade,
        })),
      });
    });
    return {
      noteId: note.noteId,
      status: note.getStatus(),
      items: note.items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        expectedQty: item.expectedQty,
        confirmedQty: item.getConfirmedQty(),
      })),
    };
  }
}
