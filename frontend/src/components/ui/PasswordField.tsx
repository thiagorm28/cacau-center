import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

/** Estilo do campo de formulário, fonte única para as telas que usam `PasswordField`. */
export const FIELD =
  "w-full rounded-pill bg-surface px-5 py-3 text-item text-text shadow-sm outline-none placeholder:text-cream-3 focus:ring-2 focus:ring-accent";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}

/**
 * Ícones no mesmo padrão do `NavDrawer`: `viewBox` de 24, `aria-hidden` no `<svg>` (o
 * rótulo acessível vive no botão) e traço herdando a cor do texto.
 */
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 20 20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Campo de senha com alternância de visibilidade (US-006, US-007).
 *
 * A visibilidade é estado interno e some a cada montagem: nada é levantado para a tela
 * nem persistido, então reabrir o login volta ao padrão oculto. Cada instância controla
 * só o seu campo — é isso que deixa "nova senha" e "confirmação" independentes.
 *
 * O `preventDefault` no `mousedown` é o que mantém o foco no `<input>`: sem ele o
 * navegador foca o botão no clique e o operador precisa tocar no campo de novo para
 * continuar digitando (US-006.AC-4).
 */
export function PasswordField({ id, label, value, onChange, autoComplete }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  const keepFocusOnInput = (event: ReactMouseEvent) => {
    event.preventDefault();
  };

  return (
    <>
      <label className="section-label text-choc-600" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} pr-14`}
        />
        <button
          type="button"
          aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={isVisible}
          onMouseDown={keepFocusOnInput}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill text-choc-600 transition-colors hover:text-choc-700"
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </>
  );
}
