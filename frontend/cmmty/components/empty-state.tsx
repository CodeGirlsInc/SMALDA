"use client";

import React from "react";
import { FileX } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <FileX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        No documents found
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Get started by uploading your first document.
      </p>
    </div>
  );
}
