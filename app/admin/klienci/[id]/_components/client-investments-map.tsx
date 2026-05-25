"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

const DEFAULT_CENTER = { lat: 52.069, lng: 19.48 };
const DEFAULT_ZOOM = 6;
const MAP_ID = "exalco-client-investments-map";

type Pinable = {
  quoteId: Id<"quotes">;
  code: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export function ClientInvestmentsMap({
  clientId,
}: {
  clientId: Id<"clients">;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const quotes = useQuery(api.quotes.listByClient, { clientId });

  const pins = useMemo<Pinable[]>(() => {
    if (!quotes) return [];
    return quotes.flatMap((q) => {
      const inv = q.investment;
      if (
        !inv ||
        typeof inv.lat !== "number" ||
        typeof inv.lng !== "number"
      ) {
        return [];
      }
      return [
        {
          quoteId: q._id,
          code: q.id,
          name: inv.name?.trim() || "Inwestycja",
          address: inv.address ?? "",
          lat: inv.lat,
          lng: inv.lng,
        },
      ];
    });
  }, [quotes]);

  if (quotes === undefined) {
    return (
      <section className="client-detail-section">
        <SectionHead title="Inwestycje na mapie" />
        <div className="client-detail-map-state">Wczytywanie…</div>
      </section>
    );
  }

  if (!apiKey) {
    return (
      <section className="client-detail-section">
        <SectionHead title="Inwestycje na mapie" />
        <div className="quote-detail-investment-noapi">
          <I.map s={28} />
          <div className="quote-detail-investment-noapi-title">
            Mapa niedostępna
          </div>
          <div className="quote-detail-investment-noapi-text">
            Ustaw <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> w{" "}
            <code>.env.local</code>.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="client-detail-section">
      <SectionHead
        title="Inwestycje na mapie"
        sub={
          pins.length === 0
            ? "Brak wycen z lokalizacją"
            : `${pins.length} ${pins.length === 1 ? "inwestycja" : "inwestycji"}`
        }
      />
      {pins.length === 0 ? (
        <div className="client-detail-map-empty">
          <I.pin s={20} />
          <div>Żadna z wycen klienta nie ma jeszcze ustawionej lokalizacji.</div>
        </div>
      ) : (
        <div className="client-detail-map-wrap">
          <APIProvider apiKey={apiKey}>
            <Map
              mapId={MAP_ID}
              defaultCenter={pins[0] ?? DEFAULT_CENTER}
              defaultZoom={pins.length === 1 ? 14 : DEFAULT_ZOOM}
              gestureHandling="cooperative"
              clickableIcons={false}
            >
              <AutoFitBounds pins={pins} />
              {pins.map((p) => (
                <AdvancedMarker
                  key={p.quoteId}
                  position={{ lat: p.lat, lng: p.lng }}
                  title={`${p.code} · ${p.name}`}
                >
                  <Pin
                    background="#2f80ed"
                    borderColor="#1c5fb8"
                    glyphColor="#fff"
                  />
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
          <ol className="client-detail-map-legend">
            {pins.map((p) => (
              <li key={p.quoteId}>
                <Link href={`/admin/wyceny/${p.quoteId}`}>
                  <span className="client-detail-map-legend-code">{p.code}</span>
                  <span className="client-detail-map-legend-name">{p.name}</span>
                  {p.address && (
                    <span className="client-detail-map-legend-addr">
                      {p.address}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function AutoFitBounds({ pins }: { pins: Pinable[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || pins.length === 0) return;
    if (pins.length === 1) {
      map.panTo({ lat: pins[0].lat, lng: pins[0].lng });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of pins) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 64);
  }, [map, pins]);
  return null;
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="client-detail-section-head">
      <div className="client-detail-section-title">
        <I.map s={14} />
        <span>{title}</span>
        {sub && <span className="client-detail-section-sub">· {sub}</span>}
      </div>
    </header>
  );
}
