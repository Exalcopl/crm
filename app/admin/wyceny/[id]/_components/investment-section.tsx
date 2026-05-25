"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Quote, InvestmentInfo } from "@/app/admin/_lib/quotes";
import { I } from "@/app/admin/_lib/icons";

const DEFAULT_CENTER = { lat: 52.069, lng: 19.48 };
const DEFAULT_ZOOM = 6;
const MAP_ID = "exalco-investment-map";

type FormState = {
  name: string;
  address: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  notes: string;
};

function toForm(inv: InvestmentInfo | undefined): FormState {
  return {
    name: inv?.name ?? "",
    address: inv?.address ?? "",
    placeId: inv?.placeId,
    lat: inv?.lat,
    lng: inv?.lng,
    notes: inv?.notes ?? "",
  };
}

function isDirty(a: FormState, b: FormState): boolean {
  return (
    a.name !== b.name ||
    a.address !== b.address ||
    a.notes !== b.notes ||
    a.placeId !== b.placeId ||
    a.lat !== b.lat ||
    a.lng !== b.lng
  );
}

export function InvestmentSection({
  quote,
  archived,
}: {
  quote: Quote;
  archived: boolean;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const setInvestment = useMutation(api.quotes.setInvestment);
  const initial = useMemo(() => toForm(quote.investment), [quote.investment]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(form, initial);
  const hasCoords =
    typeof form.lat === "number" && typeof form.lng === "number";

  async function save() {
    setSaving(true);
    try {
      await setInvestment({
        id: quote._id,
        investment: {
          name: form.name || undefined,
          address: form.address || undefined,
          placeId: form.placeId,
          lat: form.lat,
          lng: form.lng,
          notes: form.notes || undefined,
        },
      });
      toast.success("Zapisano lokalizację inwestycji");
    } catch {
      toast.error("Nie udało się zapisać");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm(toForm(quote.investment));
  }

  function handlePlaceSelected(p: {
    address: string;
    placeId?: string;
    lat?: number;
    lng?: number;
  }) {
    setForm((prev) => ({
      ...prev,
      address: p.address,
      placeId: p.placeId,
      lat: p.lat,
      lng: p.lng,
    }));
  }

  function handlePinDrag(lat: number, lng: number) {
    setForm((prev) => ({ ...prev, lat, lng }));
  }

  return (
    <section className="quote-detail-investment">
      <header className="quote-detail-investment-head">
        <div className="quote-detail-investment-title">
          <span className="quote-detail-investment-icon">
            <I.pin s={14} sw={2} />
          </span>
          <span>Lokalizacja inwestycji</span>
          {form.name ? (
            <span className="quote-detail-investment-subtitle">
              · {form.name}
            </span>
          ) : null}
        </div>
        <div className="quote-detail-investment-actions">
          {dirty && (
            <button
              type="button"
              className="quote-detail-investment-cancel"
              onClick={reset}
              disabled={saving || archived}
            >
              Anuluj
            </button>
          )}
          <button
            type="button"
            className="quote-detail-investment-save"
            onClick={() => void save()}
            disabled={!dirty || saving || archived}
          >
            {saving ? "Zapisywanie…" : dirty ? "Zapisz zmiany" : "Zapisano"}
          </button>
        </div>
      </header>

      <div className="quote-detail-investment-grid">
        <div className="quote-detail-investment-form">
          <label className="quote-detail-investment-field">
            <span className="quote-detail-investment-label">
              Nazwa inwestycji
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="np. Dom Kowalski – Wilanów"
              disabled={archived}
              className="quote-detail-investment-input"
            />
          </label>

          <label className="quote-detail-investment-field">
            <span className="quote-detail-investment-label">Adres</span>
            {apiKey ? (
              <APIProvider apiKey={apiKey}>
                <AddressAutocompleteInput
                  value={form.address}
                  disabled={archived}
                  onChangeText={(text) =>
                    setForm((p) => ({
                      ...p,
                      address: text,
                      placeId: undefined,
                    }))
                  }
                  onSelect={handlePlaceSelected}
                />
              </APIProvider>
            ) : (
              <input
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Wpisz adres inwestycji"
                disabled={archived}
                className="quote-detail-investment-input"
              />
            )}
            {hasCoords && (
              <span className="quote-detail-investment-coords">
                {form.lat?.toFixed(5)}, {form.lng?.toFixed(5)}
              </span>
            )}
          </label>

          <label className="quote-detail-investment-field">
            <span className="quote-detail-investment-label">
              Notatka do lokalizacji
            </span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="np. wjazd od tyłu posesji, kod do bramy 1234"
              disabled={archived}
              rows={3}
              className="quote-detail-investment-textarea"
            />
          </label>
        </div>

        <div className="quote-detail-investment-mapwrap">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <InvestmentMap
                lat={form.lat}
                lng={form.lng}
                disabled={archived}
                onPinDrag={handlePinDrag}
              />
            </APIProvider>
          ) : (
            <div className="quote-detail-investment-noapi">
              <I.map s={28} />
              <div className="quote-detail-investment-noapi-title">
                Mapa niedostępna
              </div>
              <div className="quote-detail-investment-noapi-text">
                Ustaw <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> w{" "}
                <code>.env.local</code>, aby włączyć podgląd i autouzupełnianie
                adresu.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AddressAutocompleteInput({
  value,
  disabled,
  onChangeText,
  onSelect,
}: {
  value: string;
  disabled?: boolean;
  onChangeText: (text: string) => void;
  onSelect: (p: {
    address: string;
    placeId?: string;
    lat?: number;
    lng?: number;
  }) => void;
}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["place_id", "formatted_address", "geometry", "name"],
      types: ["geocode"],
    });
    autocompleteRef.current = ac;
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      onSelect({
        address: place.formatted_address ?? place.name ?? "",
        placeId: place.place_id,
        lat: loc?.lat(),
        lng: loc?.lng(),
      });
    });
    return () => {
      listener.remove();
      autocompleteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
      placeholder="Wpisz adres, np. Marszałkowska 1, Warszawa"
      disabled={disabled}
      className="quote-detail-investment-input"
      autoComplete="off"
    />
  );
}

function InvestmentMap({
  lat,
  lng,
  disabled,
  onPinDrag,
}: {
  lat?: number;
  lng?: number;
  disabled?: boolean;
  onPinDrag: (lat: number, lng: number) => void;
}) {
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  const center = hasCoords ? { lat: lat!, lng: lng! } : DEFAULT_CENTER;
  const zoom = hasCoords ? 16 : DEFAULT_ZOOM;

  return (
    <div className="quote-detail-investment-map">
      <Map
        mapId={MAP_ID}
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling="cooperative"
        disableDefaultUI={false}
        clickableIcons={false}
      >
        <MapCenterer lat={lat} lng={lng} />
        {hasCoords && (
          <AdvancedMarker
            position={{ lat: lat!, lng: lng! }}
            draggable={!disabled}
            onDragEnd={(e) => {
              const loc = e.latLng;
              if (loc) onPinDrag(loc.lat(), loc.lng());
            }}
          >
            <Pin background="#2f80ed" borderColor="#1c5fb8" glyphColor="#fff" />
          </AdvancedMarker>
        )}
      </Map>
      {!hasCoords && (
        <div className="quote-detail-investment-map-hint">
          Wybierz adres powyżej, aby zobaczyć pin na mapie
        </div>
      )}
    </div>
  );
}

function MapCenterer({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    map.panTo({ lat, lng });
    const z = map.getZoom() ?? 0;
    if (z < 14) map.setZoom(16);
  }, [map, lat, lng]);
  return null;
}
