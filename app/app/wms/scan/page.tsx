"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { loadSession, saveSession, type PinSession } from "../../session";
import QrScanner from "qr-scanner";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Keyboard,
  Minus,
  Package,
  Plus,
  QrCode,
  Search,
  Truck,
  X,
} from "lucide-react";

export default function WmsScanPage() {
  return (
    <Suspense fallback={<div className="wms-page-loading">Wczytywanie…</div>}>
      <WmsScanContent />
    </Suspense>
  );
}

type Step = "scan" | "preview" | "order" | "quantity" | "success";

function WmsScanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSku = searchParams.get("sku") ?? "";

  // ─── PIN Auth ─────────────────────────────────────────────────────────────
  const [session, setSession] = useState<PinSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const resolvePin = useAction(api.authPin.resolvePin);

  useEffect(() => {
    const s = loadSession();
    setSession(s);
    setSessionReady(true);
  }, []);

  async function handlePinKey(val: string) {
    if (authenticating) return;
    setAuthError(null);

    let next = pinInput;
    if (val === "clear") {
      next = next.slice(0, -1);
    } else if (val === "reset") {
      next = "";
    } else if (next.length < 4) {
      next = next + val;
    }
    setPinInput(next);

    if (next.length === 4) {
      setAuthenticating(true);
      try {
        const result = await resolvePin({ pin: next });
        if (result) {
          const s = { userId: result.userId, email: result.email, name: result.name };
          setSession(s);
          saveSession(s);
          setPinInput("");
        } else {
          setAuthError("Nieprawidłowy PIN");
          setPinInput("");
        }
      } catch {
        setAuthError("Błąd autoryzacji");
        setPinInput("");
      } finally {
        setAuthenticating(false);
      }
    }
  }

  // ─── Flow State ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(initialSku ? "preview" : "scan");
  const [currentSku, setCurrentSku] = useState<string>(initialSku);
  const [manualSkuInput, setManualSkuInput] = useState<string>("");
  const [manualInputOpen, setManualInputOpen] = useState(false);

  // Selected Order for RW
  const [selectedOrder, setSelectedOrder] = useState<{
    _id: Id<"orders">;
    orderNumber: string;
    clientName: string;
    status?: string;
  } | null>(null);
  const [orderSearch, setOrderSearch] = useState("");

  // Quantity for RW
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success summary
  const [successData, setSuccessData] = useState<{
    docNumber: string;
    quantity: number;
    itemName: string;
    orderNumber: string;
    clientName?: string;
  } | null>(null);

  // ─── Camera Scanner ───────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || step !== "scan" || manualInputOpen) {
      if (scannerRef.current) {
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
      setCameraActive(false);
      return;
    }

    let active = true;
    const video = videoRef.current;
    if (!video) return;

    setCameraError(null);
    const scanner = new QrScanner(
      video,
      (result) => {
        if (!active) return;
        const text = result.data?.trim();
        if (text) {
          // Wyciągamy kod SKU z URL np. ?sku=PE50 lub przyjmujemy czysty kod
          const match = text.match(/[?&]sku=([^&#]+)/i);
          const detectedSku = (match ? decodeURIComponent(match[1]) : text).trim().toUpperCase();
          setCurrentSku(detectedSku);
          setStep("preview");
        }
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 6,
      },
    );

    scannerRef.current = scanner;

    scanner
      .start()
      .then(() => {
        if (active) setCameraActive(true);
      })
      .catch((err) => {
        if (active) {
          console.warn("Camera start failed:", err);
          setCameraError("Brak dostępu do aparatu. Użyj wpisywania ręcznego poniżej.");
          setCameraActive(false);
        }
      });

    return () => {
      active = false;
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [session, step, manualInputOpen]);

  // ─── Convex Queries / Mutations ───────────────────────────────────────────
  const indexData = useQuery(
    api.wms.appGetIndexBySku,
    session && currentSku ? { sku: currentSku, currentUserId: session.userId } : "skip",
  );

  const orders = useQuery(
    api.wms.appSearchOrders,
    session && (step === "order" || step === "preview")
      ? { search: orderSearch, currentUserId: session.userId }
      : "skip",
  );

  const quickRw = useMutation(api.wms.appQuickRw);

  // Automatyczne ustawienie początkowej ilości na 1
  useEffect(() => {
    if (indexData && indexData.totalAvailable > 0) {
      setQuantity((prev) => (prev <= 0 || prev > indexData.totalAvailable ? 1 : prev));
    }
  }, [indexData]);

  // ─── Akcje ────────────────────────────────────────────────────────────────
  function handleManualSkuSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = manualSkuInput.trim().toUpperCase();
    if (!clean) return;
    setCurrentSku(clean);
    setManualInputOpen(false);
    setManualSkuInput("");
    setStep("preview");
  }

  function handleResetToScan() {
    setCurrentSku("");
    setSelectedOrder(null);
    setQuantity(1);
    setErrorMessage(null);
    setSuccessData(null);
    setStep("scan");
  }

  async function handleApproveRw() {
    if (!session || !indexData || !selectedOrder) return;
    if (quantity <= 0 || quantity > indexData.totalAvailable) {
      setErrorMessage(`Ilość musi mieścić się w przedziale 1 – ${indexData.totalAvailable}.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await quickRw({
        materialId: indexData.materialId,
        orderId: selectedOrder._id,
        quantity,
        currentUserId: session.userId,
      });

      setSuccessData({
        docNumber: res.number,
        quantity,
        itemName: `${indexData.sku} • ${indexData.name}`,
        orderNumber: selectedOrder.orderNumber,
        clientName: selectedOrder.clientName,
      });
      setStep("success");
    } catch (err) {
      setErrorMessage((err as Error).message ?? "Błąd podczas zatwierdzania RW.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── EKRAN 0: Ładowanie / Blokada PIN ──────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="wms-scan-container">
        <div style={{ color: "#94a3b8", fontSize: 14 }}>Inicjalizacja…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="wms-scan-container">
        <div className="wms-pin-brand">
          <div className="wms-pin-logo">
            <QrCode size={26} color="#ffffff" />
          </div>
          <h1 className="wms-pin-title">WMS Skaner QR</h1>
          <p className="wms-pin-sub">Podaj PIN, aby przeprowadzić wydanie RW</p>
        </div>

        <div className="wms-pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`wms-pin-dot ${pinInput.length > i ? "filled" : ""}`} />
          ))}
        </div>

        {authError && <div className="wms-pin-error">{authError}</div>}
        {authenticating && <div className="wms-pin-loading">Weryfikowanie…</div>}

        <div className="wms-pin-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              className="wms-pin-key"
              onClick={() => handlePinKey(n)}
              disabled={authenticating}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="wms-pin-key action"
            onClick={() => handlePinKey("clear")}
            disabled={authenticating}
          >
            Usuń
          </button>
          <button
            type="button"
            className="wms-pin-key"
            onClick={() => handlePinKey("0")}
            disabled={authenticating}
          >
            0
          </button>
          <button
            type="button"
            className="wms-pin-key action"
            onClick={() => router.push("/app")}
            disabled={authenticating}
          >
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  // ─── GŁÓWNA APLIKACJA SKANERA ─────────────────────────────────────────────
  return (
    <div className="wms-scan-shell">
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <header className="wms-topbar">
        <button
          type="button"
          onClick={() => {
            if (step === "preview") handleResetToScan();
            else if (step === "order") setStep("preview");
            else if (step === "quantity") setStep("order");
            else router.push("/app");
          }}
          className="wms-topbar-btn"
          aria-label="Wstecz"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="wms-topbar-title">
          {step === "scan" && "Skaner regału (WMS)"}
          {step === "preview" && "Indeks towarowy"}
          {step === "order" && "Wybierz zlecenie"}
          {step === "quantity" && "Ilość do wydania"}
          {step === "success" && "Wydano z magazynu"}
        </div>

        <button
          type="button"
          onClick={() => router.push("/app")}
          className="wms-topbar-btn"
          aria-label="Zamknij"
        >
          <X size={20} />
        </button>
      </header>

      {/* ── KROK 1: APARAT / SKANER ────────────────────────────────────── */}
      {step === "scan" && (
        <div className="wms-viewfinder-wrap">
          <div className="wms-camera-box">
            <video ref={videoRef} playsInline muted className="wms-video" />
            <div className="wms-scan-overlay">
              <div className="wms-reticle">
                <div className="wms-reticle-corner tl" />
                <div className="wms-reticle-corner tr" />
                <div className="wms-reticle-corner bl" />
                <div className="wms-reticle-corner br" />
                <div className="wms-scan-laser" />
              </div>
              <p className="wms-scan-tip">Skieruj aparat na kod QR na regale</p>
            </div>
          </div>

          {cameraError && (
            <div className="wms-error-banner">
              <span>{cameraError}</span>
            </div>
          )}

          {/* Szybkie wpisanie SKU ręcznie */}
          <div className="wms-manual-panel">
            {manualInputOpen ? (
              <form onSubmit={handleManualSkuSubmit} className="wms-manual-form">
                <input
                  type="text"
                  placeholder="Wpisz kod SKU (np. PE50, PE68)…"
                  value={manualSkuInput}
                  onChange={(e) => setManualSkuInput(e.target.value)}
                  className="wms-manual-input"
                  autoFocus
                />
                <button type="submit" className="wms-manual-submit">
                  Zatwierdź
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setManualInputOpen(true)}
                className="wms-manual-toggle"
              >
                <Keyboard size={18} />
                <span>Wpisz kod SKU ręcznie</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── KROK 2: PODGLĄD INDEKSU ────────────────────────────────────── */}
      {step === "preview" && (
        <div className="wms-content-wrap">
          {indexData === undefined ? (
            <div className="wms-loading-card">Wyszukiwanie indeksu {currentSku}…</div>
          ) : indexData === null ? (
            <div className="wms-empty-card">
              <Package size={40} color="#f87171" />
              <h3>Nie znaleziono indeksu</h3>
              <p>Kod SKU &quot;{currentSku}&quot; nie istnieje w kartotece WMS.</p>
              <button type="button" onClick={handleResetToScan} className="wms-btn-secondary">
                Skanuj ponownie
              </button>
            </div>
          ) : (
            <div className="wms-card-column">
              {/* Główna karta artykułu */}
              <div className="wms-card">
                <div className="wms-card-header-row">
                  <span className="wms-sku-badge">{indexData.sku}</span>
                  {indexData.objectName && (
                    <span className="wms-category-pill">{indexData.objectName}</span>
                  )}
                </div>

                <h2 className="wms-item-title">{indexData.name}</h2>

                {/* Stan magazynowy */}
                <div className="wms-stock-metric">
                  <div>
                    <div className="wms-metric-label">Stan magazynowy</div>
                    <div className="wms-metric-val">
                      {indexData.totalAvailable}{" "}
                      <span className="wms-metric-unit">{indexData.unit}</span>
                    </div>
                  </div>
                  <div className="wms-lot-count">
                    {indexData.deliveriesCount} {indexData.deliveriesCount === 1 ? "dostawa" : "dostawy"}
                  </div>
                </div>
              </div>

              {/* Ostatnie rozchody (Traceability) */}
              {indexData.recentRw.length > 0 && (
                <div className="wms-card">
                  <div className="wms-subheading">Ostatnie wydania na zlecenia</div>
                  <div className="wms-recent-list">
                    {indexData.recentRw.map((rw) => (
                      <div key={rw._id} className="wms-recent-row">
                        <div>
                          <div className="wms-recent-order">
                            {rw.orderNumber ?? "Brak nr zlecenia"}
                            {rw.clientName ? ` • ${rw.clientName}` : ""}
                          </div>
                          <div className="wms-recent-doc">{rw.documentNumber}</div>
                        </div>
                        <div className="wms-recent-qty">
                          -{rw.quantity} {indexData.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pasek akcji na dole */}
              <div className="wms-action-footer">
                {indexData.totalAvailable > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep("order")}
                    className="wms-btn-primary"
                  >
                    <span>Wydaj na zlecenie (RW)</span>
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <div className="wms-alert-depleted">Brak towaru na stanie magazynowym.</div>
                )}

                <button
                  type="button"
                  onClick={handleResetToScan}
                  className="wms-btn-ghost"
                >
                  Skanuj inny regał
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KROK 3: WYBÓR ZLECENIA ───────────────────────────────────────── */}
      {step === "order" && indexData && (
        <div className="wms-content-wrap">
          {/* Nagłówek wybranego indeksu */}
          <div className="wms-compact-item-banner">
            <div>
              <div className="wms-banner-sku">{indexData.sku}</div>
              <div className="wms-banner-name">{indexData.name}</div>
            </div>
            <div className="wms-banner-stock">
              Stan: <b>{indexData.totalAvailable} {indexData.unit}</b>
            </div>
          </div>

          {/* Szukaj zlecenia */}
          <div className="wms-search-input-wrap">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Szukaj: nr zlecenia, klient…"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="wms-search-field"
              autoFocus
            />
            {orderSearch && (
              <button
                type="button"
                onClick={() => setOrderSearch("")}
                className="wms-clear-btn"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="wms-order-list">
            {!orders ? (
              <div className="wms-loading-card">Szukanie zleceń…</div>
            ) : orders.length === 0 ? (
              <div className="wms-empty-card">
                <p>Nie znaleziono pasujących zleceń.</p>
              </div>
            ) : (
              orders.map((o) => (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => {
                    setSelectedOrder(o);
                    setStep("quantity");
                  }}
                  className="wms-order-card-btn"
                >
                  <div className="wms-order-info">
                    <div className="wms-order-number">{o.orderNumber}</div>
                    <div className="wms-order-client">{o.clientName}</div>
                    {o.customLabel && <div className="wms-order-label">{o.customLabel}</div>}
                  </div>
                  <div className="wms-order-select-arrow">
                    <ChevronRight size={18} color="#60a5fa" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── KROK 4: ILOŚĆ I ZATWIERDZENIE ─────────────────────────────────── */}
      {step === "quantity" && indexData && selectedOrder && (
        <div className="wms-content-wrap">
          {/* Podsumowanie wybranego artykułu i zlecenia */}
          <div className="wms-card">
            <div className="wms-row-item">
              <span className="wms-row-label">Artykuł</span>
              <span className="wms-row-val">
                <b>{indexData.sku}</b> — {indexData.name}
              </span>
            </div>
            <div className="wms-row-item">
              <span className="wms-row-label">Zlecenie</span>
              <span className="wms-row-val" style={{ color: "#60a5fa" }}>
                <b>{selectedOrder.orderNumber}</b> ({selectedOrder.clientName})
              </span>
            </div>
            <div className="wms-row-item">
              <span className="wms-row-label">Dostępne</span>
              <span className="wms-row-val">
                {indexData.totalAvailable} {indexData.unit}
              </span>
            </div>
          </div>

          {/* Duży panel ilości */}
          <div className="wms-card wms-qty-card">
            <div className="wms-qty-title">Podaj ilość do pobrania</div>

            <div className="wms-qty-stepper">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="wms-stepper-btn"
                disabled={quantity <= 1}
              >
                <Minus size={22} />
              </button>

              <div className="wms-qty-input-wrap">
                <input
                  type="number"
                  min={1}
                  max={indexData.totalAvailable}
                  value={quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (Number.isNaN(v)) setQuantity(1);
                    else setQuantity(Math.min(indexData.totalAvailable, Math.max(1, v)));
                  }}
                  className="wms-qty-number-input"
                />
                <span className="wms-qty-unit-label">{indexData.unit}</span>
              </div>

              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(indexData.totalAvailable, q + 1))}
                className="wms-stepper-btn"
                disabled={quantity >= indexData.totalAvailable}
              >
                <Plus size={22} />
              </button>
            </div>

            {/* Szybkie przyciski */}
            <div className="wms-quick-pills">
              <button
                type="button"
                onClick={() => setQuantity(1)}
                className={`wms-quick-pill ${quantity === 1 ? "active" : ""}`}
              >
                1 {indexData.unit}
              </button>
              {indexData.totalAvailable >= 5 && (
                <button
                  type="button"
                  onClick={() => setQuantity(5)}
                  className={`wms-quick-pill ${quantity === 5 ? "active" : ""}`}
                >
                  5 {indexData.unit}
                </button>
              )}
              {indexData.totalAvailable >= 10 && (
                <button
                  type="button"
                  onClick={() => setQuantity(10)}
                  className={`wms-quick-pill ${quantity === 10 ? "active" : ""}`}
                >
                  10 {indexData.unit}
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuantity(indexData.totalAvailable)}
                className={`wms-quick-pill ${quantity === indexData.totalAvailable ? "active" : ""}`}
              >
                Wszystko ({indexData.totalAvailable})
              </button>
            </div>

            <div className="wms-fifo-note">
              System automatycznie pobierze sztuki z najstarszych dostaw (FIFO).
            </div>
          </div>

          {errorMessage && <div className="wms-error-banner">{errorMessage}</div>}

          {/* Główny przycisk zatwierdzenia RW */}
          <div className="wms-action-footer">
            <button
              type="button"
              onClick={handleApproveRw}
              disabled={submitting}
              className="wms-btn-primary wms-btn-rw"
            >
              {submitting ? (
                "Zatwierdzanie RW…"
              ) : (
                <>
                  <Check size={20} />
                  <span>Zatwierdź wydanie RW ({quantity} {indexData.unit})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep("order")}
              disabled={submitting}
              className="wms-btn-ghost"
            >
              Zmień zlecenie
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 5: SUKCES ──────────────────────────────────────────────── */}
      {step === "success" && successData && (
        <div className="wms-content-wrap">
          <div className="wms-success-card">
            <div className="wms-success-icon-wrap">
              <CheckCircle2 size={48} color="#22c55e" />
            </div>

            <h2 className="wms-success-title">Rozchód zatwierdzony!</h2>
            <div className="wms-success-doc">{successData.docNumber}</div>

            <div className="wms-success-details">
              <div className="wms-success-row">
                <span>Wydano:</span>
                <b>{successData.quantity} szt.</b>
              </div>
              <div className="wms-success-row">
                <span>Artykuł:</span>
                <b>{successData.itemName}</b>
              </div>
              <div className="wms-success-row">
                <span>Zlecenie CRM:</span>
                <b>{successData.orderNumber}</b>
              </div>
              {successData.clientName && (
                <div className="wms-success-row">
                  <span>Klient:</span>
                  <b>{successData.clientName}</b>
                </div>
              )}
            </div>

            <div className="wms-success-actions">
              <button
                type="button"
                onClick={handleResetToScan}
                className="wms-btn-primary"
              >
                <Camera size={18} />
                <span>Skanuj kolejny indeks</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/app")}
                className="wms-btn-secondary"
              >
                Wróć do aplikacji
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stylistyka inline dla pełnej niezależności PWA ──────────────── */}
      <style jsx>{`
        .wms-scan-shell {
          min-height: 100vh;
          background: #0b0f19;
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding-bottom: 24px;
        }
        .wms-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #111726;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .wms-topbar-title {
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
        }
        .wms-topbar-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 8px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .wms-topbar-btn:active {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }
        .wms-viewfinder-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 16px;
          gap: 16px;
        }
        .wms-camera-box {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          max-height: 400px;
          background: #000;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
        }
        .wms-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .wms-scan-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .wms-reticle {
          position: relative;
          width: 220px;
          height: 220px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
        }
        .wms-reticle-corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: #60a5fa;
          border-style: solid;
        }
        .wms-reticle-corner.tl {
          top: -2px;
          left: -2px;
          border-width: 3px 0 0 3px;
          border-top-left-radius: 6px;
        }
        .wms-reticle-corner.tr {
          top: -2px;
          right: -2px;
          border-width: 3px 3px 0 0;
          border-top-right-radius: 6px;
        }
        .wms-reticle-corner.bl {
          bottom: -2px;
          left: -2px;
          border-width: 0 0 3px 3px;
          border-bottom-left-radius: 6px;
        }
        .wms-reticle-corner.br {
          bottom: -2px;
          right: -2px;
          border-width: 0 3px 3px 0;
          border-bottom-right-radius: 6px;
        }
        .wms-scan-laser {
          position: absolute;
          left: 6px;
          right: 6px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #38bdf8, transparent);
          box-shadow: 0 0 8px #38bdf8;
          animation: wmsLaserAnim 2s infinite ease-in-out;
        }
        @keyframes wmsLaserAnim {
          0% { top: 10%; opacity: 0.3; }
          50% { top: 90%; opacity: 1; }
          100% { top: 10%; opacity: 0.3; }
        }
        .wms-scan-tip {
          margin-top: 18px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(0, 0, 0, 0.6);
          padding: 6px 14px;
          border-radius: 20px;
          backdrop-filter: blur(4px);
        }
        .wms-manual-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 8px;
        }
        .wms-manual-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #141b2d;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .wms-manual-toggle:active {
          color: #ffffff;
          background: #1e293b;
        }
        .wms-manual-form {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .wms-manual-input {
          flex: 1;
          background: #141b2d;
          border: 1px solid #3b82f6;
          color: #ffffff;
          padding: 12px 14px;
          border-radius: 10px;
          font-family: monospace;
          font-size: 15px;
          font-weight: 600;
        }
        .wms-manual-submit {
          background: #3b82f6;
          border: none;
          color: #ffffff;
          padding: 0 16px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .wms-content-wrap {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }
        .wms-card {
          background: #141b2d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .wms-card-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .wms-sku-badge {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
          font-family: monospace;
          font-weight: 700;
          font-size: 14px;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .wms-category-pill {
          font-size: 12px;
          color: #94a3b8;
        }
        .wms-item-title {
          font-size: 18px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
          line-height: 1.3;
        }
        .wms-stock-metric {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 12px;
          margin-top: 4px;
        }
        .wms-metric-label {
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .wms-metric-val {
          font-size: 26px;
          font-weight: 800;
          color: #38bdf8;
          margin-top: 2px;
        }
        .wms-metric-unit {
          font-size: 14px;
          font-weight: 500;
          color: #94a3b8;
        }
        .wms-lot-count {
          font-size: 12px;
          color: #94a3b8;
        }
        .wms-subheading {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .wms-recent-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wms-recent-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 12px;
        }
        .wms-recent-order {
          font-weight: 600;
          color: #f8fafc;
        }
        .wms-recent-doc {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
          margin-top: 2px;
        }
        .wms-recent-qty {
          font-family: monospace;
          font-weight: 700;
          color: #f87171;
        }
        .wms-action-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 12px;
        }
        .wms-btn-primary {
          background: #3b82f6;
          color: #ffffff;
          border: none;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
        }
        .wms-btn-primary:active {
          background: #2563eb;
        }
        .wms-btn-rw {
          background: #10b981;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
        }
        .wms-btn-rw:active {
          background: #059669;
        }
        .wms-btn-secondary {
          background: #1e293b;
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .wms-btn-ghost {
          background: transparent;
          color: #94a3b8;
          border: none;
          padding: 10px;
          font-size: 13px;
          cursor: pointer;
        }
        .wms-btn-ghost:active {
          color: #ffffff;
        }
        .wms-compact-item-banner {
          background: #141b2d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .wms-banner-sku {
          font-family: monospace;
          font-size: 13px;
          font-weight: 700;
          color: #a5b4fc;
        }
        .wms-banner-name {
          font-size: 13px;
          color: #f8fafc;
          margin-top: 2px;
        }
        .wms-banner-stock {
          font-size: 12px;
          color: #94a3b8;
        }
        .wms-search-input-wrap {
          display: flex;
          align-items: center;
          background: #141b2d;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 0 12px;
          gap: 8px;
        }
        .wms-search-field {
          flex: 1;
          background: transparent;
          border: none;
          color: #ffffff;
          padding: 12px 0;
          font-size: 14px;
          outline: none;
        }
        .wms-clear-btn {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
        }
        .wms-order-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          max-height: calc(100vh - 220px);
        }
        .wms-order-card-btn {
          background: #141b2d;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          cursor: pointer;
        }
        .wms-order-card-btn:active {
          background: #1e293b;
          border-color: #3b82f6;
        }
        .wms-order-number {
          font-size: 14px;
          font-weight: 700;
          color: #60a5fa;
        }
        .wms-order-client {
          font-size: 13px;
          color: #f8fafc;
          margin-top: 2px;
        }
        .wms-order-label {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .wms-row-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 4px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .wms-row-label {
          color: #94a3b8;
        }
        .wms-row-val {
          color: #f8fafc;
          text-align: right;
        }
        .wms-qty-card {
          align-items: center;
          text-align: center;
        }
        .wms-qty-title {
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .wms-qty-stepper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin: 12px 0;
        }
        .wms-stepper-btn {
          width: 52px;
          height: 52px;
          border-radius: 26px;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .wms-stepper-btn:active {
          background: #3b82f6;
        }
        .wms-stepper-btn:disabled {
          opacity: 0.3;
          pointer-events: none;
        }
        .wms-qty-input-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .wms-qty-number-input {
          width: 90px;
          background: transparent;
          border: none;
          color: #f8fafc;
          font-size: 40px;
          font-weight: 800;
          text-align: center;
          outline: none;
        }
        .wms-qty-unit-label {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
        }
        .wms-quick-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 6px;
        }
        .wms-quick-pill {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
        }
        .wms-quick-pill.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #ffffff;
          font-weight: 600;
        }
        .wms-fifo-note {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }
        .wms-success-card {
          background: #141b2d;
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 16px;
          padding: 28px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
        }
        .wms-success-title {
          font-size: 20px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }
        .wms-success-doc {
          font-family: monospace;
          font-size: 16px;
          font-weight: 700;
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          padding: 4px 12px;
          border-radius: 6px;
        }
        .wms-success-details {
          width: 100%;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 12px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 8px 0;
        }
        .wms-success-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
        .wms-success-row span {
          color: #94a3b8;
        }
        .wms-success-row b {
          color: #f8fafc;
        }
        .wms-success-actions {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        .wms-error-banner {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          text-align: center;
        }
        .wms-alert-depleted {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          padding: 12px;
          border-radius: 10px;
          font-size: 13px;
          text-align: center;
          font-weight: 500;
        }
        .wms-empty-card, .wms-loading-card {
          padding: 36px 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        /* PIN Pad Styles */
        .wms-scan-container {
          min-height: 100vh;
          background: #0b0f19;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .wms-pin-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
          text-align: center;
        }
        .wms-pin-logo {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        }
        .wms-pin-title {
          font-size: 20px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }
        .wms-pin-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 4px 0 0;
        }
        .wms-pin-dots {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }
        .wms-pin-dot {
          width: 14px;
          height: 14px;
          border-radius: 7px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          transition: all 0.15s;
        }
        .wms-pin-dot.filled {
          background: #38bdf8;
          border-color: #38bdf8;
          transform: scale(1.15);
        }
        .wms-pin-error {
          color: #f87171;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .wms-pin-loading {
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .wms-pin-keypad {
          display: grid;
          grid-template-columns: repeat(3, 72px);
          gap: 14px;
        }
        .wms-pin-key {
          width: 72px;
          height: 72px;
          border-radius: 36px;
          background: #141b2d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          font-size: 24px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .wms-pin-key:active {
          background: #3b82f6;
        }
        .wms-pin-key.action {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
