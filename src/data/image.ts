const KEEP_ALPHA_SOURCE = /png|webp|gif/i;

export function pickTargetSize(w: number, h: number, cap = 2048) {
  const longest = Math.max(w, h);
  const factor = longest > cap ? cap / longest : 1;
  return {
    w: Math.max(1, Math.round(w * factor)),
    h: Math.max(1, Math.round(h * factor)),
    factor,
  };
}

export function shouldKeepPng(mime: string, hasAlpha: boolean): boolean {
  return KEEP_ALPHA_SOURCE.test(mime) && hasAlpha;
}

async function fileHasAlpha(file: File, w: number, h: number): Promise<boolean> {
  const probeBitmap = await createImageBitmap(file);
  try {
    const probe = document.createElement("canvas");
    const { w: pw, h: ph } = pickTargetSize(w, h, 1);
    probe.width = pw;
    probe.height = ph;
    const ctx = probe.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(probeBitmap, 0, 0, pw, ph);
    const data = ctx.getImageData(0, 0, pw, ph).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } finally {
    probeBitmap.close();
  }
}

// exercised in browser at Task 10 preview
export async function fileToDataUrl(
  file: File,
  cap = 2048,
): Promise<{ dataUrl: string; keptPng: boolean }> {
  const bitmap = await createImageBitmap(file);
  try {
    const { w, h, factor } = pickTargetSize(bitmap.width, bitmap.height, cap);
    const hasAlpha = await fileHasAlpha(file, bitmap.width, bitmap.height);
    const keptPng = factor === 1 && shouldKeepPng(file.type, hasAlpha);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (!keptPng) {
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), keptPng };
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), keptPng: false };
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("Falha ao ler imagem redimensionada."));
      fr.readAsDataURL(blob);
    });
    return { dataUrl, keptPng: true };
  } finally {
    bitmap.close?.();
  }
}