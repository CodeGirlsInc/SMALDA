"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
} from "react-leaflet";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type DocumentStatus =
  | "VERIFIED"
  | "PENDING"
  | "FLAGGED"
  | "REJECTED"
  | "ANALYZING";

interface DocumentWithLocation {
  id: string;
  title: string;
  status: DocumentStatus;
  riskScore: number;
  latitude: number;
  longitude: number;
}

const PIN_COLOURS: Record<DocumentStatus, string> = {
  VERIFIED: "#22c55e",
  FLAGGED: "#eab308",
  PENDING: "#9ca3af",
  REJECTED: "#ef4444",
  ANALYZING: "#3b82f6",
};

const LABEL_CLASSES: Record<DocumentStatus, string> = {
  VERIFIED: "bg-green-100 text-green-800 border-green-300",
  FLAGGED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PENDING: "bg-gray-100 text-gray-600 border-gray-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
  ANALYZING: "bg-blue-100 text-blue-800 border-blue-300",
};

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function createColouredIcon(colour: string) {
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 36"><path fill="${colour}" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/><circle fill="#fff" cx="12" cy="12" r="3"/></svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

export default function MapPageContent() {
  const [docs, setDocs] = useState<DocumentWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<[number, number] | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/documents?limit=200`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`);

      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      const located = list.filter(
        (d: DocumentWithLocation) => d.latitude != null && d.longitude != null,
      );
      setDocs(located);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserRegion([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // fallback to default centre
        },
      );
    }
  }, []);

  function handleResetView() {
    if (!mapRef.current) return;
    if (docs.length > 0) {
      const bounds = L.latLngBounds(
        docs.map((d) => [d.latitude, d.longitude] as [number, number]),
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (userRegion) {
      mapRef.current.setView(userRegion, 10);
    }
  }

  const centre: [number, number] = userRegion ?? [9.082, 8.6753];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Document Map</h1>
          <p className="text-sm text-gray-500">
            {docs.length > 0
              ? `Showing ${docs.length} document${docs.length !== 1 ? "s" : ""} with location data.`
              : "Geographic view of land documents."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDocuments}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset view
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <div style={{ height: "600px", width: "100%" }}>
          <MapContainer
            center={centre}
            zoom={6}
            className="h-full w-full"
            zoomControl={false}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />

            {docs.length === 0 && !loading && (
              <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
                <div className="pointer-events-auto max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto h-10 w-10 text-gray-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <h3 className="mt-3 text-sm font-semibold text-gray-900">
                    No location data
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Documents with GPS coordinates will appear on this map.
                    Upload a document with location metadata to see it here.
                  </p>
                </div>
              </div>
            )}

            {docs.length > 0 &&
              docs.map((doc) => {
                const colour = PIN_COLOURS[doc.status] ?? PIN_COLOURS.PENDING;
                const icon = createColouredIcon(colour);
                return (
                  <Marker
                    key={doc.id}
                    position={[doc.latitude, doc.longitude]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="min-w-[180px]">
                        <p className="font-semibold text-gray-900">
                          {doc.title}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${LABEL_CLASSES[doc.status] ?? LABEL_CLASSES.PENDING}`}
                        >
                          {doc.status}
                        </span>
                        {doc.riskScore != null && (
                          <p className="mt-1 text-xs text-gray-500">
                            Risk: {doc.riskScore}/100
                          </p>
                        )}
                        <a
                          href={`/documents/${doc.id}`}
                          className="mt-2 block text-xs font-medium text-blue-600 hover:underline"
                        >
                          View details →
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchDocuments}
            className="mt-2 text-sm font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">Legend:</span>
        <span className="flex items-center gap-1">
          <span
            className="h-3 w-3 rounded-full bg-green-500"
            aria-hidden="true"
          />{" "}
          Verified
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-3 w-3 rounded-full bg-yellow-500"
            aria-hidden="true"
          />{" "}
          Flagged
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-3 w-3 rounded-full bg-gray-400"
            aria-hidden="true"
          />{" "}
          Pending
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-3 w-3 rounded-full bg-red-500"
            aria-hidden="true"
          />{" "}
          Rejected
        </span>
      </div>
    </div>
  );
}
