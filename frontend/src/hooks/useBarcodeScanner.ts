import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type ReaderOptions, prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// O binário WASM é servido pelo próprio app, não por CDN: só assim o service worker
// consegue pré-cacheá-lo e a bipagem continua funcionando offline (ADR-003, ADR-008).
prepareZXingModule({ overrides: { locateFile: () => wasmUrl } });

export type BarcodeScannerError = "permission-denied" | "camera-unavailable" | null;

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  /**
   * Quantos ciclos seguidos sem nenhum símbolo no quadro liberam a releitura do mesmo
   * código. É o que separa "a mesma caixa em vários frames" de "outra caixa do mesmo
   * produto": caixas iguais compartilham o código, então só a ausência em quadro
   * distingue as duas situações (US-004.EC-1).
   */
  rearmAfterEmptyFrames?: number;
  frameIntervalMs?: number;
}

interface UseBarcodeScannerResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  error: BarcodeScannerError;
  isScanning: boolean;
}

// Dois ciclos (~500ms no intervalo padrão) absorvem um quadro perdido com a caixa
// parada em frente à câmera, e ainda assim rearmam bem dentro do tempo de troca de
// caixa do operador.
const DEFAULT_REARM_AFTER_EMPTY_FRAMES = 2;
const DEFAULT_FRAME_INTERVAL_MS = 250;

/**
 * Códigos de caixa são lineares (1D). Restringir os formatos evita que uma leitura
 * parcial seja "resgatada" como outro simbologia qualquer.
 */
const READER_OPTIONS: ReaderOptions = {
  formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E", "Code128", "Code39", "ITF"],
  tryHarder: true,
  maxNumberOfSymbols: 1,
  // Exige que a mesma leitura se repita em várias linhas do frame: é o que
  // descarta decodificações parciais de código borrado (US-004.EC-2).
  minLineCount: 2,
};

const captureFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null => {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Leitura de código de barras por câmera via ZXing-wasm (ADR-008). A biblioteca fica
 * isolada aqui: as telas só recebem `onScan(code)` e um estado de erro.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  rearmAfterEmptyFrames = DEFAULT_REARM_AFTER_EMPTY_FRAMES,
  frameIntervalMs = DEFAULT_FRAME_INTERVAL_MS,
}: UseBarcodeScannerOptions): UseBarcodeScannerResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Código que o scanner entende estar em quadro agora, com quantos ciclos seguidos
  // ele já apareceu vazio. `null` = nada em quadro, qualquer leitura vale.
  const inFrameRef = useRef<{ code: string; emptyFrames: number } | null>(null);
  const decodingRef = useRef(false);
  // Cada ativação da câmera é uma sessão. Uma decodificação que só resolve depois que a
  // sessão terminou (scanner desabilitado por um diálogo, tela desmontada) pertence a uma
  // câmera que já parou: aceitá-la processaria uma bipagem com o diálogo aberto.
  const sessionRef = useRef(0);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<BarcodeScannerError>(null);
  const [isScanning, setIsScanning] = useState(false);

  onScanRef.current = onScan;

  const acceptCode = useCallback((code: string) => {
    const previous = inFrameRef.current;
    inFrameRef.current = { code, emptyFrames: 0 };
    // Enquanto o mesmo código continuar em quadro é a mesma caixa física sendo relida,
    // por mais tempo que ela fique ali. Um valor diferente é sempre outra caixa.
    if (previous !== null && previous.code === code) return;
    onScanRef.current(code);
  }, []);

  const noteEmptyFrame = useCallback(() => {
    const inFrame = inFrameRef.current;
    if (inFrame === null) return;
    const emptyFrames = inFrame.emptyFrames + 1;
    // A caixa saiu de vista: a próxima leitura desse código é outra caixa, e não uma
    // repetição — inclusive quando as duas são do mesmo produto.
    inFrameRef.current =
      emptyFrames >= rearmAfterEmptyFrames ? null : { code: inFrame.code, emptyFrames };
  }, [rearmAfterEmptyFrames]);

  const decodeFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video === null || canvas === null || decodingRef.current) return;
    decodingRef.current = true;
    try {
      const frame = captureFrame(video, canvas);
      if (frame === null) return;
      const session = sessionRef.current;
      const results = await readBarcodes(frame, READER_OPTIONS);
      if (session !== sessionRef.current) return;
      // Só leitura íntegra conta: `isValid === false`, erro de decodificação ou
      // texto vazio significam leitura parcial/duvidosa e são descartados.
      const decoded = results.find(
        (result) => result.isValid && result.error === "" && result.text.length > 0,
      );
      if (decoded !== undefined) acceptCode(decoded.text);
      // Só o quadro sem símbolo nenhum conta como ausência. Uma leitura parcial
      // descartada acima (US-004.EC-2) significa que a caixa continua em frente à
      // câmera; rearmar ali arriscaria contar a mesma caixa duas vezes.
      else if (results.length === 0) noteEmptyFrame();
    } catch {
      // Frame ilegível é rotina numa leitura contínua: tenta de novo no próximo.
      // Não conta como ausência: o ciclo não chegou a observar o quadro vazio.
    } finally {
      decodingRef.current = false;
    }
  }, [acceptCode, noteEmptyFrame]);

  useEffect(() => {
    if (!enabled) {
      setIsScanning(false);
      return;
    }
    canvasRef.current = document.createElement("canvas");
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (cause) {
        if (cancelled) return;
        const denied = cause instanceof Error && cause.name === "NotAllowedError";
        setError(denied ? "permission-denied" : "camera-unavailable");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (video !== null) {
        video.srcObject = stream;
        // `play()` devolve `undefined` em navegadores antigos e no jsdom da suíte:
        // normalizar evita quebrar o start por causa do retorno.
        await Promise.resolve(video.play()).catch(() => undefined);
      }
      setError(null);
      setIsScanning(true);
      timer = setInterval(() => void decodeFrame(), frameIntervalMs);
    };

    void start();

    return () => {
      cancelled = true;
      // Encerra a sessão: o resultado de qualquer decodificação ainda em voo é descartado.
      sessionRef.current += 1;
      if (timer !== null) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current !== null) videoRef.current.srcObject = null;
      // Sessão nova começa desarmada: nada do que estava em quadro antes deve
      // suprimir a primeira leitura depois que a câmera volta.
      inFrameRef.current = null;
      setIsScanning(false);
    };
  }, [enabled, frameIntervalMs, decodeFrame]);

  return { videoRef, error, isScanning };
}
