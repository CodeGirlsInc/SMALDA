export function getOptimizedImageUrl(src: string, width = 300, quality = 75): string {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  return `${src}?w=${width}&q=${quality}`;
}
