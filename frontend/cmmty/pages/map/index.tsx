"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Search } from "lucide-react";
import L from "leaflet";
import type { Document, DocumentStatus } from "../../types/document";
import "leaflet/dist/leaflet.css";

const defaultIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const documents: Array<Document & { coordinates: [number, number] }> = [
  {
    id: "doc-1",
    ownerId: "1",
    ownerName: "Amara Reyes",
    title: "Parcel Claim 146A",
    filePath: "/documents/doc-1.pdf",
    fileHash: "abc123",
    fileSize: 102400,
    mimeType: "application/pdf",
    status: DocumentStatus.VERIFIED,
    riskScore: 12,
    riskFlags: ["boundary_dispute"],
    stellarTxHash: "tx123",
    ledgerNumber: 415,
    anchoredTimestamp: "2026-04-01T10:00:00Z",
    createdAt: "2026-03-28",
    updatedAt: "2026-04-01",
    coordinates: [51.505, -0.09],
  },
  {
    id: "doc-2",
    ownerId: "2",
    ownerName: "Chinwe Okafor",
    title: "Survey Report B12",
    filePath: "/documents/doc-2.pdf",
    fileHash: "def456",
    fileSize: 198000,
    mimeType: "application/pdf",
    status: DocumentStatus.PENDING,
    riskScore: 35,
    riskFlags: ["expired_permit"],
    stellarTxHash: "tx456",
    ledgerNumber: 417,
    anchoredTimestamp: "2026-04-10T08:20:00Z",
    createdAt: "2026-04-09",
    updatedAt: "2026-04-10",
    coordinates: [51.51, -0.1],
  },
  {
    id: "doc-3",
    ownerId: "3",
    ownerName: "Nia Banda",
    title: "Ownership Transfer 9C",
    filePath: "/documents/doc-3.pdf",
    fileHash: "ghi789",
    fileSize: 205000,
    mimeType: "application/pdf",
    status: DocumentStatus.ANALYZING,
    riskScore: 51,
    riskFlags: ["duplicate_claim"],
    stellarTxHash: "tx789",
    ledgerNumber: 420,
    anchoredTimestamp: "2026-04-15T13:15:00Z",
    createdAt: "2026-04-14",
    updatedAt: "2026-04-15",
    coordinates: [51.503, -0.08],
  },
];

const statusLabel: Record<DocumentStatus, string> = {
  [DocumentStatus.PENDING]: "Pending",
  [DocumentStatus.ANALYZING]: "Analyzing",
  [DocumentStatus.VERIFIED]: "Verified",
  [DocumentStatus.FLAGGED]: "Flagged",
  [DocumentStatus.REJECTED]: "Rejected",
};

export default function MapPage() {
  const [search, setSearch] = useState("");

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const query = search.toLowerCase();
        return (
          document.title.toLowerCase().includes(query) ||
          document.status.toLowerCase().includes(query) ||
          document.ownerName.toLowerCase().includes(query)
        );
      }),
    [search]
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Land Parcel Map</p>
            <h1 className="text-3xl font-semibold text-slate-900">Document geography at a glance</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Explore documents by parcel location and open each document's status and details with a single click.
            </p>
          </div>
          <div className="w-full md:w-96">
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="search">
              Search documents
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by title, owner, or status"
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-[580px] w-full">
              <MapContainer
                center={[51.505, -0.09]}
                zoom={13}
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredDocuments.map((document) => (
                  <Marker
                    key={document.id}
                    position={document.coordinates}
                    icon={defaultIcon}
                  >
                    <Popup>
                      <div className="space-y-2 text-sm text-slate-900">
                        <p className="font-semibold">{document.title}</p>
                        <p className="text-slate-600">Status: {statusLabel[document.status]}</p>
                        <Link href={`/documents/${document.id}`} className="text-indigo-600 underline">
                        View document
                      </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Showing</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">{filteredDocuments.length} documents</h2>
              <p className="mt-2 text-sm text-slate-600">
                These markers are filtered by your current search query and plotted on the map above.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Document locations</h3>
              <div className="mt-4 space-y-4">
                {filteredDocuments.length === 0 ? (
                  <p className="text-sm text-slate-600">No documents match your search.</p>
                ) : (
                  filteredDocuments.map((document) => (
                    <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{document.title}</p>
                      <p className="text-sm text-slate-600">Owner: {document.ownerName}</p>
                      <p className="text-sm text-slate-600">{statusLabel[document.status]}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/documents/${document.id}`}
                          className="inline-flex min-w-[120px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
