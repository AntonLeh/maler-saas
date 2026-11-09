// Fotos vor dem Hochladen verkleinern (spart mobile Daten auf der Baustelle)

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bildformat wird nicht unterstützt."));
    };
    img.src = url;
  });

/** Liefert ein JPEG mit höchstens maxSide Pixeln Kantenlänge. Kleine JPG/PNG/WebP bleiben unverändert. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  if (ALLOWED.includes(file.type) && file.size <= 400 * 1024) return file;
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch (e) {
    if (ALLOWED.includes(file.type)) return file;
    throw e;
  }
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return ALLOWED.includes(file.type) ? file : Promise.reject(new Error("Bildformat wird nicht unterstützt."));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) return ALLOWED.includes(file.type) ? file : Promise.reject(new Error("Bildformat wird nicht unterstützt."));
  if (ALLOWED.includes(file.type) && blob.size >= file.size) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export const fileExtension = (file: File) => {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};
