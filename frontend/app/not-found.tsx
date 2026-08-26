import { NotFoundContent } from "@/components/NotFoundContent";

/**
 * Root fallback for any request that bypasses the locale boundary.
 * Lives outside app/[locale]/ because Next.js renders this when
 * notFound() is called from a route with no nearer not-found.tsx.
 *
 * The root fallback uses the default English copy because no locale is
 * available at this boundary.
 */
export default function GlobalNotFound() {
  return (
    <NotFoundContent
      description="The page you are looking for could not be found."
      homeLabel="Go back home"
    />
  );
}
