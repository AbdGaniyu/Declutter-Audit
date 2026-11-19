/** Public URL for a lot photo in the lot-photos bucket. */
export function photoUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/lot-photos/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Resize to max 1600px on the long edge and encode as WebP (JPEG fallback),
 * so uploads stay small on mobile data.
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob('image/jpeg');
  if (!jpeg) throw new Error('Could not encode image');
  return jpeg;
}
