import { NotFoundContent } from "@/components/NotFoundContent";

/**
 * Scoped not-found for the document detail route. A missing hash means no
 * record was ever anchored, not that the verifier adjudicated and rejected it.
 * This boundary has no locale parameter, so it uses the default English copy.
 */
export default function DocumentNotFound() {
  return (
    <NotFoundContent
      description="No record anchored"
      homeLabel="Back to home"
      detailDescription="This document hash has no record anchored on the Stellar ledger. A failed verification is different: it means a record exists but did not match what you submitted."
    />
  );
}
