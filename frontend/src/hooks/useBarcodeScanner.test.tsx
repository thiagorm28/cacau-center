import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readBarcodes } from "zxing-wasm/reader";
import { type BarcodeScannerError, useBarcodeScanner } from "./useBarcodeScanner";

vi.mock("zxing-wasm/reader", () => ({ readBarcodes: vi.fn(), prepareZXingModule: vi.fn() }));

const readBarcodesMock = vi.mocked(readBarcodes);

type Frame = Awaited<ReturnType<typeof readBarcodes>>;

const decoded = (overrides: { text: string; isValid?: boolean; error?: string }) =>
  [
    {
      text: overrides.text,
      isValid: overrides.isValid ?? true,
      error: overrides.error ?? "",
    },
  ] as unknown as Frame;

/** Quadro em que o ZXing não encontrou símbolo nenhum: nada em frente à câmera. */
const emptyFrame = () => [] as unknown as Frame;

/**
 * Encena uma sequência determinística de quadros, um por ciclo de decodificação. O
 * último quadro se repete indefinidamente, então a cena descreve só o que importa.
 */
const scriptFrames = (first: Frame, ...rest: readonly Frame[]): void => {
  const frames = [first, ...rest];
  let current = first;
  let index = 0;
  readBarcodesMock.mockImplementation(() => {
    current = frames[index] ?? current;
    index += 1;
    return Promise.resolve(current);
  });
};

/** Espera `count` ciclos de decodificação a mais do que os já executados. */
const waitForDecodeCycles = async (count: number): Promise<void> => {
  const target = readBarcodesMock.mock.calls.length + count;
  await waitFor(() => expect(readBarcodesMock.mock.calls.length).toBeGreaterThanOrEqual(target));
};

const FRAME_INTERVAL_MS = 100;
const REARM_AFTER_EMPTY_FRAMES = 2;

let lastError: BarcodeScannerError = null;

function ScannerHarness({
  onScan,
  enabled = true,
}: {
  onScan: (code: string) => void;
  enabled?: boolean;
}) {
  const scanner = useBarcodeScanner({
    onScan,
    enabled,
    rearmAfterEmptyFrames: REARM_AFTER_EMPTY_FRAMES,
    frameIntervalMs: FRAME_INTERVAL_MS,
  });
  lastError = scanner.error;
  return <video ref={scanner.videoRef} data-testid="preview" />;
}

const mockCamera = (): void => {
  const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
};

const denyCamera = (): void => {
  const denial = new Error("Permission denied");
  denial.name = "NotAllowedError";
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(denial) },
  });
};

beforeEach(() => {
  lastError = null;
  vi.clearAllMocks();
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    value: 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    value: 480,
  });
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  } as unknown as CanvasRenderingContext2D);
  mockCamera();
});

describe("useBarcodeScanner", () => {
  it("UT-044: dispara onScan com o valor decodificado de um frame válido", async () => {
    readBarcodesMock.mockResolvedValue(decoded({ text: "7891234567895" }));
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledWith("7891234567895"));
  });

  it("UT-045: expõe estado de erro específico quando a permissão de câmera é negada", async () => {
    denyCamera();
    readBarcodesMock.mockResolvedValue(decoded({ text: "7891234567895" }));
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(lastError).toBe("permission-denied"));
    expect(onScan).not.toHaveBeenCalled();
  });

  it("UT-046: a mesma caixa lida em frames seguidos dispara um único onScan", async () => {
    readBarcodesMock.mockResolvedValue(decoded({ text: "7891234567895" }));
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readBarcodesMock.mock.calls.length).toBeGreaterThan(2));
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("US-004.EC-1: duas caixas do mesmo produto, separadas por quadros vazios, contam duas vezes", async () => {
    const code = "7891234567895";
    // Caixa em quadro, caixa retirada por dois ciclos, outra caixa igual em quadro.
    scriptFrames(decoded({ text: code }), emptyFrame(), emptyFrame(), decoded({ text: code }));
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(2));
    expect(onScan).toHaveBeenNthCalledWith(1, code);
    expect(onScan).toHaveBeenNthCalledWith(2, code);
  });

  it("US-004.EC-1: um único quadro vazio não rearma o scanner com a mesma caixa em frente", async () => {
    const code = "7891234567895";
    scriptFrames(decoded({ text: code }), emptyFrame(), decoded({ text: code }));
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1));
    await waitForDecodeCycles(4);
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("US-004.EC-1: leitura parcial não conta como ausência e não rearma o scanner", async () => {
    const code = "7891234567895";
    const blurred = decoded({ text: "789123", isValid: false, error: "checksum" });
    scriptFrames(decoded({ text: code }), blurred, blurred, decoded({ text: code }));
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1));
    await waitForDecodeCycles(4);
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("desabilitar o scanner descarta a decodificação que ainda estava em voo", async () => {
    // Um diálogo aberto desabilita o scanner; a decodificação que já estava aguardando o
    // WASM não pode virar bipagem depois que a câmera parou.
    let resolveDecode: (frame: Frame) => void = () => undefined;
    readBarcodesMock.mockImplementation(
      () =>
        new Promise<Frame>((resolve) => {
          resolveDecode = resolve;
        }),
    );
    const onScan = vi.fn();

    const view = render(<ScannerHarness onScan={onScan} />);
    await waitForDecodeCycles(1);
    view.rerender(<ScannerHarness onScan={onScan} enabled={false} />);

    await act(async () => {
      resolveDecode(decoded({ text: "7891234567895" }));
    });

    expect(onScan).not.toHaveBeenCalled();
  });

  it("UT-047: frame de baixa confiança/parcial não dispara onScan", async () => {
    readBarcodesMock.mockResolvedValue(
      decoded({ text: "789123", isValid: false, error: "checksum" }),
    );
    const onScan = vi.fn();

    render(<ScannerHarness onScan={onScan} />);

    await waitFor(() => expect(readBarcodesMock.mock.calls.length).toBeGreaterThan(1));
    expect(onScan).not.toHaveBeenCalled();
  });
});
