import type { ImageLoader } from "next/image";

const NEXT_IMAGE_PATH = "/_next/image";
const DEFAULT_QUALITY = 75;
const SIGNED_QUERY_KEYS = new Set([
  "signature",
  "sig",
  "token",
  "expires",
  "policy",
  "key-pair-id",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-date",
  "x-amz-security-token",
]);

/**
 * Build URLs through Next's built-in image optimizer. That endpoint negotiates
 * WebP (or another configured format) from the request's Accept header. A
 * custom loader has a single-string contract, so it cannot expose a separate
 * <picture> fallback itself; callers needing one must provide it explicitly.
 *
 * Signed image URLs are returned unchanged. Proxying or rewriting those URLs
 * can invalidate provider signatures, and the original URL is the safe
 * unoptimized source when its signature is opaque to this application; it is
 * not a separate browser-format fallback. Non-local HTTP
 * sources still need an explicit `images.remotePatterns` entry before Next's
 * optimizer will fetch them.
 */
function buildNextImageUrl(
  src: string,
  width: number,
  quality = DEFAULT_QUALITY,
): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (src.startsWith("//")) {
    throw new Error("Protocol-relative image URLs are not supported");
  }

  const hashIndex = src.indexOf("#");
  const source = hashIndex === -1 ? src : src.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : src.slice(hashIndex);
  const queryIndex = source.indexOf("?");
  const query = queryIndex === -1 ? "" : source.slice(queryIndex + 1);
  const isSigned = [...new URLSearchParams(query).keys()].some((key) => {
    const normalizedKey = key.toLowerCase();
    return (
      SIGNED_QUERY_KEYS.has(normalizedKey) ||
      normalizedKey.startsWith("x-amz-")
    );
  });

  const isNextImageUrl =
    source === NEXT_IMAGE_PATH || source.startsWith(`${NEXT_IMAGE_PATH}?`);
  if (isSigned || isNextImageUrl) return src;

  const params = new URLSearchParams();
  params.set("url", source);
  params.set("w", String(width));
  params.set("q", String(quality));

  return `${NEXT_IMAGE_PATH}?${params.toString()}${fragment}`;
}

export function getOptimizedImageUrl(
  src: string,
  width = 300,
  quality = DEFAULT_QUALITY,
): string {
  return buildNextImageUrl(src, width, quality);
}

const imageLoader: ImageLoader = ({ src, width, quality }) =>
  buildNextImageUrl(src, width, quality);

export default imageLoader;
