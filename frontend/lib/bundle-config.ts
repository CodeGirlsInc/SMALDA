/**
 * The map route owns the application’s intentional client-only bundle split.
 * Leaflet and the map content depend on browser APIs, so the boundary must
 * remain `ssr: false`; the policy lives at the actual dynamic import site.
 */
export const clientOnlyBundleBoundary = {
  ssr: false,
} as const;
