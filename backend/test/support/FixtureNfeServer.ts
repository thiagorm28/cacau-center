import { type Server, createServer } from "node:http";
import { type AddressInfo } from "node:net";

export type FixtureResponse = { status: number; body: string };

/**
 * Servidor local que substitui a API interna da Cacau Show nos testes de integração.
 * Cada `documento` pode ser programado com uma resposta própria, permitindo simular
 * nota encontrada, nota inexistente e indisponibilidade do serviço.
 */
export default class FixtureNfeServer {
  private server?: Server;
  private readonly responses = new Map<string, FixtureResponse>();
  private fallback: FixtureResponse = { status: 200, body: "<html>documento nao localizado</html>" };

  async start(): Promise<string> {
    this.server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const documento = url.searchParams.get("documento") ?? "";
      const configured = this.responses.get(documento) ?? this.fallback;
      response.writeHead(configured.status, { "content-type": "text/xml; charset=utf-8" });
      response.end(configured.body);
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  respondWith(documento: string, response: FixtureResponse): void {
    this.responses.set(documento, response);
  }

  respondWithXml(documento: string, xml: string): void {
    this.respondWith(documento, { status: 200, body: xml });
  }

  setFallback(response: FixtureResponse): void {
    this.fallback = response;
  }

  reset(): void {
    this.responses.clear();
    this.fallback = { status: 200, body: "<html>documento nao localizado</html>" };
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (server === undefined) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.server = undefined as unknown as Server;
  }
}
