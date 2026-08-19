import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";
import { SessionProvider } from "./session/SessionContext";

const container = document.getElementById("root");
if (container === null) throw new Error("Elemento #root não encontrado");

// App shell offline + atualização automática do service worker (ADR-003).
registerSW({ immediate: true });

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
