"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buildScanUrl, QrSvg } from "../../_components/qr";

/**
 * Wydruk etykiet QR dla indeksów (A4, siatka 3 × 8).
 * Adres: /admin/wms/indeksy/etykiety?ids=<id1>,<id2>,…
 * Każda etykieta: kod QR (link do skanera PWA) + SKU.
 */
export default function EtykietyPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#8b949e" }}>Wczytywanie…</div>}>
      <EtykietyContent />
    </Suspense>
  );
}

function EtykietyContent() {
  const params = useSearchParams();
  const ids = useMemo(() => (params.get("ids") ?? "").split(",").filter(Boolean), [params]);
  const indexes = useQuery(api.wms.listIndexes, {});

  const labels = useMemo(() => {
    if (!indexes) return [];
    const byId = new Map(indexes.map((r) => [r.material._id as string, r.material]));
    return ids
      .map((id) => byId.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m && !!m.sku)
      .map((m) => ({ id: m._id, sku: m.sku as string }));
  }, [indexes, ids]);

  return (
    <div>
      <style>{`
        .qr-sheet {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          width: 210mm;
          background: #fff;
          color: #000;
          margin: 0 auto;
        }
        .qr-label {
          height: 37mm;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4mm;
          padding: 3mm;
          border: 1px dashed #c8c8c8;
          break-inside: avoid;
        }
        .qr-label-sku {
          font-family: ui-monospace, Menlo, monospace;
          font-weight: 700;
          font-size: 15pt;
          word-break: break-all;
          max-width: 30mm;
          line-height: 1.1;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden !important; }
          .qr-print-area, .qr-print-area * { visibility: visible !important; }
          .qr-print-area { position: absolute; left: 0; top: 0; padding: 0 !important; }
          .qr-label { border-color: transparent; }
          .qr-no-print { display: none !important; }
        }
      `}</style>

      <div
        className="qr-no-print"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 24px",
          borderBottom: "1px solid #21262d",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f6fc" }}>Etykiety QR ({labels.length})</div>
          <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
            Arkusz A4, 24 etykiety (3 × 8). Zeskanowanie kodu otwiera wydanie RW w aplikacji mobilnej.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => history.back()}
            style={{
              background: "transparent",
              border: "1px solid #30363d",
              color: "#c9d1d9",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Wróć
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={labels.length === 0}
            style={{
              background: "#238636",
              border: "1px solid #2ea043",
              color: "#fff",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: labels.length ? "pointer" : "not-allowed",
              opacity: labels.length ? 1 : 0.5,
            }}
          >
            Drukuj
          </button>
        </div>
      </div>

      <div className="qr-print-area" style={{ padding: 24 }}>
        {!indexes ? (
          <div style={{ color: "#8b949e", fontSize: 13 }}>Wczytywanie indeksów…</div>
        ) : labels.length === 0 ? (
          <div style={{ color: "#8b949e", fontSize: 13 }}>Nie wybrano indeksów z kodem SKU.</div>
        ) : (
          <div className="qr-sheet">
            {labels.map((l) => (
              <div key={l.id} className="qr-label">
                <QrSvg value={buildScanUrl(l.sku)} size={110} />
                <div className="qr-label-sku">{l.sku}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
