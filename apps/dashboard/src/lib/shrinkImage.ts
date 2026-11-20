/**
 * Shrinks a photo in the browser before upload (D17): at most 1600 px on the long side,
 * WebP at 85%. A browser that can't write WebP (older Safari) gives PNG; the server takes both.
 */
const MAX_SIDE = 1600;

export async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // follows the photo's EXIF rotation
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/webp", 0.85),
  );
}
