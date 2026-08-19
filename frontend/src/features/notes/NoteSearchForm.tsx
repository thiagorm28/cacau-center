import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, NetworkError, createNote } from "../../api/client";
import type { CreatedNote } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { PillButton } from "../../components/ui/PillButton";

interface NoteSearchFormProps {
  isOnline: boolean;
  onNoteCreated: (note: CreatedNote) => void;
}

const INVOICE_NUMBER = /^\d+$/;

const messageFor = (error: unknown): string => {
  if (error instanceof NetworkError) return "Sem conexão: é preciso estar conectado para buscar uma nota.";
  if (error instanceof ApiError) {
    if (error.status === 404) return "Nota não encontrada. Confira o número e tente novamente.";
    if (error.status === 502) return "Serviço indisponível, tente novamente.";
    return error.message;
  }
  return "Não foi possível buscar a nota.";
};

/**
 * Entrada da nota por número de faturamento. Não há leitura de QR code aqui:
 * esse fluxo foi retirado do produto (US-002, ADR-005).
 */
export function NoteSearchForm({ isOnline, onNoteCreated }: NoteSearchFormProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedNote | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const value = invoiceNumber.trim();
    // Formato conferido antes da chamada (US-001.EC-1 e EC-3).
    if (value === "") {
      setError("Informe o número de faturamento.");
      return;
    }
    if (!INVOICE_NUMBER.test(value)) {
      setError("Número de faturamento inválido: use apenas dígitos.");
      return;
    }
    // Buscar nota nova exige conexão; as notas já carregadas seguem operáveis (US-013.AC-2).
    if (!isOnline) {
      setError("Sem conexão: é preciso estar conectado para buscar uma nota.");
      return;
    }
    setIsSearching(true);
    try {
      const note = await createNote(value);
      setCreated(note);
      setInvoiceNumber("");
      onNoteCreated(note);
    } catch (cause) {
      setCreated(null);
      setError(messageFor(cause));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="section-label text-choc-600" htmlFor="invoiceNumber">
          Número de faturamento
        </label>
        <input
          id="invoiceNumber"
          name="invoiceNumber"
          inputMode="numeric"
          autoComplete="off"
          value={invoiceNumber}
          onChange={(event) => setInvoiceNumber(event.target.value)}
          className="w-full rounded-pill bg-surface px-5 py-3 text-item text-text shadow-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <PillButton type="submit" fullWidth disabled={isSearching}>
          {isSearching ? "Buscando…" : "Buscar nota"}
        </PillButton>
      </form>
      {error === null ? null : <Banner tone="error">{error}</Banner>}
      {created === null ? null : <CreatedNoteItems note={created} />}
    </section>
  );
}

function CreatedNoteItems({ note }: { note: CreatedNote }) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-md">
      <p className="section-label text-choc-600">Itens esperados</p>
      <ul className="mt-3 flex flex-col gap-2">
        {note.items.map((item) => (
          <li key={item.itemId} className="flex items-baseline justify-between gap-4">
            <span className="text-item font-semibold text-text">{item.description}</span>
            <span className="text-meta text-accent-700">
              {item.confirmedQty}/{item.expectedQty}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
