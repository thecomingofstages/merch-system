/**
 * Product, variant and promotion images live in R2 (D17), served from the bucket's own domain
 * (IMAGES_PUBLIC_URL). Uploads come from the dashboard; links are copied in when a record is
 * saved; a file is deleted once no live product, variant or set uses it.
 */
import type { Config } from "../config/init";
import { appConf } from "../config/app.conf";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

export type ImageStore = { bucket: R2Bucket; base: string };
export const imageStore = (config: Pick<Config, "IMAGES" | "IMAGES_PUBLIC_URL">): ImageStore => ({
  bucket: config.IMAGES,
  base: config.IMAGES_PUBLIC_URL,
});

const EXTENSIONS: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
export const imageTypes = Object.keys(EXTENSIONS);

/** The R2 key of one of our image URLs, or null for any other URL. */
const keyOf = (store: ImageStore, url: string) => {
  const prefix = `${store.base}/`;
  return url.startsWith(prefix) && url.length > prefix.length ? url.slice(prefix.length) : null;
};

/** Stores the bytes under a new random key and answers its public URL. Names are never reused, so caching forever is safe. */
export async function putImage(store: ImageStore, bytes: ArrayBuffer | Uint8Array, type: string | undefined): Promise<string> {
  const contentType = (type ?? "").split(";")[0]!.trim().toLowerCase();
  const extension = EXTENSIONS[contentType];
  if (!extension) throw ApiError.validation(`image: use ${imageTypes.join(", ")}`);
  if (bytes.byteLength === 0 || bytes.byteLength > appConf.imageMaxBytes) {
    throw ApiError.validation(`image: must be between 1 byte and ${appConf.imageMaxBytes / 1024 / 1024} MB`);
  }
  const key = `${crypto.randomUUID()}.${extension}`;
  await store.bucket.put(key, bytes, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
  return `${store.base}/${key}`;
}

/** One of our URLs as it is; any other link downloaded and copied into R2. */
export async function storeLink(store: ImageStore, url: string): Promise<string> {
  if (keyOf(store, url)) return url;
  if (!/^https?:\/\//i.test(url)) throw ApiError.validation(`image: ${url} is not an http(s) link`);
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    throw ApiError.validation(`image: couldn't download ${url}`);
  }
  if (!res.ok) throw ApiError.validation(`image: ${url} answered HTTP ${res.status}`);
  // Refuse a big file before reading it; the length can be missing, so putImage checks again.
  if (Number(res.headers.get("content-length") ?? 0) > appConf.imageMaxBytes) {
    throw ApiError.validation(`image: ${url} is larger than ${appConf.imageMaxBytes / 1024 / 1024} MB`);
  }
  return putImage(store, await res.arrayBuffer(), res.headers.get("content-type") ?? undefined);
}

/** `storeLink` for an optional image (a variant's or a set's): null stays null. */
export const storeOptional = (store: ImageStore, url: string | null | undefined) =>
  url ? storeLink(store, url) : Promise.resolve(url);

/**
 * Deletes the R2 files behind these URLs that no live product, variant or set still uses
 * (two records may share one image). Call it after the change that dropped them.
 */
export async function releaseImages(m: Models, store: ImageStore, urls: (string | null | undefined)[]) {
  for (const url of new Set(urls)) {
    const key = url && keyOf(store, url);
    if (!key) continue;
    const used =
      (await m.Product.exists({ archived: false, $or: [{ image: url }, { variants: { $elemMatch: { image: url, archived: false } } }] })) ||
      (await m.Promotion.exists({ archived: false, image: url }));
    if (!used) await store.bucket.delete(key);
  }
}
