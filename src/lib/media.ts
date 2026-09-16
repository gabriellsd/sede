export function isSecureMediaContext() {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function canUseMicOrCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function canShareScreen() {
  return Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export function explainMediaError(error: unknown, kind: "mic" | "camera" | "screen") {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  const combined = `${name} ${message}`.toLowerCase();

  if (!isSecureMediaContext()) {
    return "O navegador só libera microfone, câmera e tela em http://localhost:3000. Abra esse endereço no Chrome, não no preview do editor nem pelo IP da rede.";
  }

  if (kind === "screen" && !canShareScreen()) {
    return "Este navegador não compartilha tela. Use Chrome ou Edge em http://localhost:3000.";
  }

  if ((kind === "mic" || kind === "camera") && !canUseMicOrCamera()) {
    return "Este navegador não acessa microfone/câmera. Abra http://localhost:3000 no Chrome.";
  }

  if (name === "NotAllowedError" || combined.includes("permission")) {
    return kind === "screen"
      ? "Compartilhamento de tela bloqueado. Permita quando o Chrome pedir."
      : "Permissão negada. Clique no cadeado ao lado do endereço e permita microfone/câmera.";
  }

  if (name === "NotFoundError" || combined.includes("requested device not found")) {
    return kind === "camera"
      ? "Nenhuma câmera encontrada. Você ainda pode compartilhar a tela."
      : "Nenhum microfone encontrado. Você ainda pode ligar a câmera ou compartilhar a tela.";
  }

  if (name === "NotSupportedError" || combined.includes("not supported")) {
    return "Este navegador não suporta essa captura. Abra o Chrome em http://localhost:3000 (janela normal, não o preview do Cursor).";
  }

  if (name === "NotReadableError") {
    return "O dispositivo está ocupado em outro app. Feche Teams, Meet ou o Discord e tente de novo.";
  }

  return kind === "screen"
    ? "Não foi possível compartilhar a tela."
    : kind === "camera"
      ? "Não foi possível ligar a câmera."
      : "Não foi possível ligar o microfone. Câmera e tela ainda podem funcionar.";
}

export async function getMicrophoneStream() {
  if (!canUseMicOrCamera()) {
    throw new DOMException("Not supported", "NotSupportedError");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export async function getCameraTrack() {
  if (!canUseMicOrCamera()) {
    throw new DOMException("Not supported", "NotSupportedError");
  }
  const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  const track = media.getVideoTracks()[0];
  if (!track) throw new DOMException("Requested device not found", "NotFoundError");
  return track;
}

export async function getScreenTrack() {
  if (!canShareScreen()) {
    throw new DOMException("Not supported", "NotSupportedError");
  }
  const media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const track = media.getVideoTracks()[0];
  if (!track) throw new DOMException("Not supported", "NotSupportedError");
  return track;
}
