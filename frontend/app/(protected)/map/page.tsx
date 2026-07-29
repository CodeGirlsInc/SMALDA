"use client";

import dynamic from "next/dynamic";

const MapPageContent = dynamic(() => import("./MapPageContent"), {
  ssr: false,
});

export default function MapPage() {
  return <MapPageContent />;
}
