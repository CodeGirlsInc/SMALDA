// frontend/components/blockchain/QRVerification.tsx
"use client";

import { QRCodeCanvas } from "qrcode.react";

export function QRVerification({ url }: { url: string }) {
  return (
    <div className="flex justify-center">
      <QRCodeCanvas value={url} size={120} />
    </div>
  );
}
