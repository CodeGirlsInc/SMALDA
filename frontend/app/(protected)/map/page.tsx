"use client";

import dynamic from "next/dynamic";
import { clientOnlyBundleBoundary } from "@/lib/bundle-config";

const MapPageContent = dynamic(
  () => import("./MapPageContent"),
  clientOnlyBundleBoundary,
);

export default function MapPage() {
  return <MapPageContent />;
}
