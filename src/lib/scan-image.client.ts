const RESIZE_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MAX_LONG_EDGE = 2000;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode image"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function prepareScanImage(file: File): Promise<File> {
  if (file.size <= RESIZE_THRESHOLD_BYTES) {
    return file;
  }

  const mimeType =
    file.type === "image/png" || file.type === "image/webp"
      ? file.type
      : "image/jpeg";
  const image = await loadImageFromFile(file);
  const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(
    canvas,
    mimeType,
    mimeType === "image/jpeg" ? 0.88 : undefined,
  );

  return new File([blob], file.name || "scan.jpg", { type: mimeType });
}
