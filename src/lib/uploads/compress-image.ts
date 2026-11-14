// Storage caps uploads at 2 MB. Limit photo dimensions too: a small compressed file can still decode to millions of pixels.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_EDGE_PX = 2560;
const QUALITIES = [0.85, 0.7];

function canvasToJpeg(bitmap: ImageBitmap, scale: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  // JPEG has no transparency: paint white first so transparent PNG areas do not turn black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Shrinks photos exceeding 2 MB or a 2560px edge. Other files remain unchanged. */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (file.size <= MAX_UPLOAD_BYTES && longestEdge <= MAX_EDGE_PX) return file;
    let scale = Math.min(1, MAX_EDGE_PX / longestEdge);
    for (let round = 0; round < 6; round++) {
      for (const quality of QUALITIES) {
        const blob = await canvasToJpeg(bitmap, scale, quality);
        if (blob && blob.size <= MAX_UPLOAD_BYTES) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
        }
      }
      scale *= 0.75;
    }
    return file;
  } finally {
    bitmap.close();
  }
}

/** Copy of the form data with every file passed through `compressImage`. */
export async function compressFormFiles(formData: FormData): Promise<FormData> {
  const result = new FormData();
  for (const [key, value] of formData.entries()) {
    result.append(key, value instanceof File ? await compressImage(value) : value);
  }
  return result;
}
