"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ParcelSidebar, {
  type ParcelDocument,
} from "@/components/map/ParcelSidebar";
import { apiUrl } from "@/lib/api-config";
import { getAccessToken } from "@/lib/session";
import {
  clearLastViewedParcel,
  readLastViewedParcelId,
  saveLastViewedParcelId,
} from "@/lib/map-state";
import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
} from "react-leaflet";

const MAP_PAGE_SIZE = 100;
const MAP_MAX_DOCUMENTS = 1000;

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
  riskScore: number | null;
  riskFlags: string[] | null;
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
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(value: unknown): DocumentStatus {
  const status = typeof value === "string" ? value.toUpperCase() : "";
  if (
    status === "VERIFIED" ||
    status === "PENDING" ||
    status === "FLAGGED" ||
    status === "REJECTED" ||
    status === "ANALYZING"
  ) {
    return status;
  }
  return "PENDING";
}

function toDocumentWithLocation(value: unknown): DocumentWithLocation | null {
  if (!isRecord(value)) return null;

  const id = value.id;
  const title = value.title;
  if (typeof id !== "string" || typeof title !== "string") return null;

  if (
    value.latitude == null ||
    value.longitude == null ||
    value.latitude === "" ||
    value.longitude === ""
  ) {
    return null;
  }

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    id,
    title,
    status: normalizeStatus(value.status),
    riskScore:
      typeof value.riskScore === "number" && Number.isFinite(value.riskScore)
        ? value.riskScore
        : null,
    riskFlags: Array.isArray(value.riskFlags)
      ? value.riskFlags.filter((flag): flag is string => typeof flag === "string")
      : null,
    latitude,
    longitude,
  };
}

type ParcelLookup =
  | { kind: "found"; document: DocumentWithLocation }
  | { kind: "missing" }
  | { kind: "transient" };

async function fetchDocumentById(id: string): Promise<ParcelLookup> {
  try {
    const response = await fetch(
      apiUrl(`/documents/${encodeURIComponent(id)}`),
      { credentials: "include", headers: getAuthHeaders() },
    );
    if (response.status === 403 || response.status === 404) {
      return { kind: "missing" };
    }
    if (!response.ok) return { kind: "transient" };

    const payload: unknown = await response.json();
    if (
      !isRecord(payload) ||
      typeof payload.id !== "string" ||
      typeof payload.title !== "string"
    ) {
      return { kind: "transient" };
    }

    const document = toDocumentWithLocation(payload);
    return document ? { kind: "found", document } : { kind: "missing" };
  } catch {
    return { kind: "transient" };
  }
}

async function fetchCurrentUserId(): Promise<string | null> {
  try {
    const response = await fetch(apiUrl("/auth/me"), {
      credentials: "include",
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.id !== "string" || !body.id) {
      return null;
    }
    return body.id;
  } catch {
    return null;
  }
}

function toRiskScore(value: number | null): number | null {
  if (value == null) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toParcelDocument(document: DocumentWithLocation): ParcelDocument {
  return {
    id: document.id,
    name: document.title,
    status: document.status,
    riskScore: toRiskScore(document.riskScore),
    ownerName: null,
    isOwnedByViewer: true,
    stellarAnchorDate: null,
    stellarTxHash: null,
    flags: document.riskFlags ?? [],
    detailsUrl: `/documents/${document.id}`,
  };
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
  const [missingLocationCount, setMissingLocationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<[number, number] | null>(null);
  const [tileError, setTileError] = useState(false);
  const [tileKey, setTileKey] = useState(0);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapTotal, setMapTotal] = useState(0);
  const [mapLoadedCount, setMapLoadedCount] = useState(0);
  const [mapLimited, setMapLimited] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapUserIdRef = useRef<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = await fetchCurrentUserId();
      if (!userId) {
        throw new Error("Unable to verify your session.");
      }

      const previousUserId = mapUserIdRef.current;
      if (previousUserId && previousUserId !== userId) {
        clearLastViewedParcel(previousUserId);
        setDocs([]);
        setSelectedParcelId(null);
        setSidebarOpen(false);
        setMapTotal(0);
        setMapLoadedCount(0);
        setMapLimited(false);
      }
      mapUserIdRef.current = userId;

      const loaded: unknown[] = [];
      let total = 0;
      let page = 1;
      let limited = false;
      const maxPages = Math.ceil(MAP_MAX_DOCUMENTS / MAP_PAGE_SIZE);

      while (page <= maxPages) {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(MAP_PAGE_SIZE),
        });
        const res = await fetch(apiUrl("/documents", params), {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error(`Failed to load documents (${res.status})`);
        }

        const payload: unknown = await res.json();
        const pageData = Array.isArray(payload)
          ? payload
          : isRecord(payload) && Array.isArray(payload.data)
            ? payload.data
            : null;
        if (!pageData) {
          throw new Error("Invalid documents response");
        }

        const pageLimit =
          isRecord(payload) &&
          typeof payload.limit === "number" &&
          Number.isFinite(payload.limit)
            ? Math.max(1, payload.limit)
            : MAP_PAGE_SIZE;
        const remaining = Math.max(0, MAP_MAX_DOCUMENTS - loaded.length);
        loaded.push(...pageData.slice(0, remaining));
        total =
          isRecord(payload) &&
          typeof payload.total === "number" &&
          Number.isFinite(payload.total)
            ? payload.total
            : loaded.length;

        if (
          pageData.length < pageLimit ||
          loaded.length >= total ||
          loaded.length >= MAP_MAX_DOCUMENTS
        ) {
          limited = total > loaded.length;
          break;
        }
        page += 1;
      }

      const locatedFromList = loaded
        .map(toDocumentWithLocation)
        .filter((document): document is DocumentWithLocation => document !== null);
      const missingLocationCount = loaded.length - locatedFromList.length;
      let located = locatedFromList;
      let lastViewedId = readLastViewedParcelId(userId);

      if (
        lastViewedId &&
        !located.some((document) => document.id === lastViewedId)
      ) {
        const lookup = await fetchDocumentById(lastViewedId);
        if (lookup.kind === "found") {
          located = [...located, lookup.document];
        } else if (lookup.kind === "missing") {
          clearLastViewedParcel(userId);
          lastViewedId = null;
        }
      }

      setDocs(located);
      setMissingLocationCount(missingLocationCount);
      setMapTotal(total);
      setMapLoadedCount(loaded.length);
      setMapLimited(limited || total > loaded.length);

      if (lastViewedId && located.some((document) => document.id === lastViewedId)) {
        setSelectedParcelId(lastViewedId);
        setSidebarOpen(true);
      } else {
        setSelectedParcelId(null);
        setSidebarOpen(false);
      }
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

  const selectedDocument = selectedParcelId
    ? docs.find((document) => document.id === selectedParcelId) ?? null
    : null;
  const selectedLatitude = selectedDocument?.latitude;
  const selectedLongitude = selectedDocument?.longitude;

  useEffect(() => {
    if (
      loading ||
      !mapRef.current ||
      selectedLatitude == null ||
      selectedLongitude == null
    ) {
      return;
    }

    mapRef.current.setView(
      [selectedLatitude, selectedLongitude],
      Math.max(mapRef.current.getZoom(), 13),
      { animate: false },
    );
  }, [loading, selectedLatitude, selectedLongitude]);

  function handleSelectParcel(document: DocumentWithLocation) {
    const userId = mapUserIdRef.current;
    if (!userId) return;

    setSelectedParcelId(document.id);
    setSidebarOpen(true);
    saveLastViewedParcelId(document.id, userId);
  }

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
            {mapLimited
              ? `Showing ${docs.length} mapped document${docs.length !== 1 ? "s" : ""}. Loaded ${mapLoadedCount} of ${mapTotal} records.`
              : docs.length > 0 && mapTotal > 0
                ? `Showing ${docs.length} mapped document${docs.length !== 1 ? "s" : ""} from ${mapTotal} total records.`
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
              key={tileKey}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{
                tileerror: () => setTileError(true),
                load: () => setTileError(false),
              }}
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

            {tileError && (
              <div className="pointer-events-none absolute inset-0 z-[1001] flex items-center justify-center">
                <div className="pointer-events-auto max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto h-10 w-10 text-red-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                  <h3 className="mt-3 text-sm font-semibold text-gray-900">
                    Map tiles failed to load
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    The map tile provider could not be reached. Check your
                    connection or try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTileError(false);
                      setTileKey((k) => k + 1);
                    }}
                    className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Retry map
                  </button>
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
                    title={doc.title}
                    eventHandlers={{
                      click: () => handleSelectParcel(doc),
                    }}
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
                            Risk: {toRiskScore(doc.riskScore)}/100
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
        {sidebarOpen && selectedDocument && (
          <ParcelSidebar
            document={toParcelDocument(selectedDocument)}
            open
            onClose={() => setSidebarOpen(false)}
          />
        )}
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

      {mapLimited && (
        <p className="mt-4 text-xs text-amber-700">
          Map loading is capped at {mapLoadedCount} documents. Narrow the document list to inspect the remaining records.
        </p>
      )}

      {missingLocationCount > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          {missingLocationCount} document
          {missingLocationCount !== 1 ? "s" : ""} without location data
          (excluded from the map).
        </p>
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
