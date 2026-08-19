import type { BrowserContext, Page } from "@playwright/test";

/**
 * Câmera falsa para a suíte E2E.
 *
 * A bipagem do produto é leitura de câmera de verdade (`useBarcodeScanner` +
 * ZXing-wasm) e não existe entrada manual de código na UI. Em vez de burlar o app,
 * a suíte substitui apenas a borda de I/O: `navigator.mediaDevices.getUserMedia`
 * devolve o `MediaStream` de um `<canvas>` onde o teste desenha um código de barras
 * ITF de verdade. O ZXing decodifica o mesmo caminho de produção, quadro a quadro.
 */

/** Janela de debounce do `useBarcodeScanner` para o mesmo código (`DEFAULT_DEBOUNCE_MS`). */
const SCANNER_DEBOUNCE_MS = 1200;

/** Margem sobre o debounce, para que a releitura do mesmo código nunca caia na janela. */
const REPEAT_GUARD_MS = 1400;

declare global {
  interface Window {
    __cacauCamera?: { show: (code: string) => void; clear: () => void };
  }
}

/**
 * Injeta a câmera falsa antes de qualquer script da página. Precisa ser instalada no
 * `BrowserContext` (e não por página) porque o app pede a câmera já na montagem da
 * tela de bipagem.
 */
export async function installFakeCamera(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // Interleaved 2 of 5: 5 elementos por dígito, `0` = estreito e `1` = largo.
    // É um dos formatos aceitos por `useBarcodeScanner` e codifica dígitos em pares,
    // que é exatamente o formato dos `cProd` (18 dígitos) das notas.
    const ITF_PATTERNS = [
      "00110",
      "10001",
      "01001",
      "11000",
      "00101",
      "10100",
      "01100",
      "00011",
      "10010",
      "01010",
    ];

    const NARROW = 4;
    const WIDE = NARROW * 3;
    const HEIGHT = 320;
    const QUIET_ZONE = NARROW * 12;

    interface Element {
      readonly bar: boolean;
      readonly wide: boolean;
    }

    const elementsFor = (code: string): Element[] => {
      const elements: Element[] = [
        // Start: quatro elementos estreitos (barra, espaço, barra, espaço).
        { bar: true, wide: false },
        { bar: false, wide: false },
        { bar: true, wide: false },
        { bar: false, wide: false },
      ];
      for (let index = 0; index < code.length; index += 2) {
        const barPattern = ITF_PATTERNS[Number(code[index])];
        const spacePattern = ITF_PATTERNS[Number(code[index + 1])];
        // Intercala: o primeiro dígito do par vira barras, o segundo vira espaços.
        for (let position = 0; position < 5; position += 1) {
          elements.push({ bar: true, wide: barPattern[position] === "1" });
          elements.push({ bar: false, wide: spacePattern[position] === "1" });
        }
      }
      // Stop: barra larga, espaço estreito, barra estreita.
      elements.push({ bar: true, wide: true });
      elements.push({ bar: false, wide: false });
      elements.push({ bar: true, wide: false });
      return elements;
    };

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = HEIGHT + QUIET_ZONE * 2;

    const context2d = canvas.getContext("2d", { willReadFrequently: true });

    let currentCode: string | null = null;

    const paint = (): void => {
      if (context2d === null) return;
      context2d.fillStyle = "#ffffff";
      context2d.fillRect(0, 0, canvas.width, canvas.height);
      if (currentCode === null) return;
      const elements = elementsFor(currentCode);
      const width = elements.reduce((total, element) => total + (element.wide ? WIDE : NARROW), 0);
      context2d.fillStyle = "#000000";
      let x = Math.max(QUIET_ZONE, Math.floor((canvas.width - width) / 2));
      for (const element of elements) {
        const elementWidth = element.wide ? WIDE : NARROW;
        if (element.bar) context2d.fillRect(x, QUIET_ZONE, elementWidth, HEIGHT);
        x += elementWidth;
      }
    };

    const show = (code: string): void => {
      if (code.length % 2 !== 0) throw new Error(`ITF exige um número par de dígitos: ${code}`);
      currentCode = code;
      paint();
    };

    const clear = (): void => {
      currentCode = null;
      paint();
    };

    // O `captureStream` só emite quadro quando o canvas muda: um canvas parado deixa a
    // trilha sem nenhum quadro. Repintar continuamente garante que qualquer trilha —
    // inclusive uma criada depois do código já estar na tela — receba quadros.
    setInterval(paint, 1000 / 15);
    paint();

    // Um `MediaStream` novo por chamada, e não um compartilhado: o `useBarcodeScanner`
    // encerra as trilhas na limpeza do efeito, e o StrictMode roda esse ciclo duas vezes
    // em desenvolvimento — uma trilha compartilhada chegaria morta à segunda montagem.
    // 15 fps: o app decodifica a cada 250ms, então há sempre quadro novo disponível.
    const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: Object.assign(mediaDevices, {
        getUserMedia: () => Promise.resolve(canvas.captureStream(15)),
        enumerateDevices: () =>
          Promise.resolve([
            { deviceId: "fake-camera", kind: "videoinput", label: "Câmera E2E", groupId: "e2e" },
          ]),
      }),
    });

    window.__cacauCamera = { show, clear };
  });
}

/**
 * Bipa caixas numa página. Guarda a última leitura para respeitar o debounce do
 * scanner: bipar a mesma caixa duas vezes seguidas exige esperar a janela fechar,
 * senão o segundo quadro é descartado como repetição do mesmo frame.
 */
export class BoxScanner {
  private lastCode: string | null = null;
  private lastScanAt = 0;

  constructor(private readonly page: Page) {}

  /**
   * Mostra o código para a câmera, espera o efeito esperado na tela e limpa o quadro.
   * Limpar é obrigatório: com o código ainda visível, o scanner voltaria a lê-lo assim
   * que a janela de debounce fechasse.
   */
  async scan(code: string, expectEffect: () => Promise<void>): Promise<void> {
    if (this.lastCode === code) {
      const elapsed = Date.now() - this.lastScanAt;
      if (elapsed < REPEAT_GUARD_MS) await this.page.waitForTimeout(REPEAT_GUARD_MS - elapsed);
    }
    await this.page.evaluate((value) => window.__cacauCamera?.show(value), code);
    try {
      await expectEffect();
    } finally {
      await this.page.evaluate(() => window.__cacauCamera?.clear());
      this.lastCode = code;
      this.lastScanAt = Date.now();
    }
  }

  /** Bipa o mesmo código `times` vezes, checando o efeito de cada leitura. */
  async scanMany(
    code: string,
    times: number,
    expectEffect: (scanNumber: number) => Promise<void>,
  ): Promise<void> {
    for (let scanNumber = 1; scanNumber <= times; scanNumber += 1) {
      await this.scan(code, () => expectEffect(scanNumber));
    }
  }
}

export { SCANNER_DEBOUNCE_MS };
