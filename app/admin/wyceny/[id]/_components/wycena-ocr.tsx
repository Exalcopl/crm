"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

type OcrDokument = { numer?: string | null; data?: string | null; tytul?: string | null };
type OcrStrona = { nazwa?: string | null; nip?: string | null; adres?: string | null };
type OcrPozycja = {
  lp?: number | null;
  opis?: string | null;
  ilosc?: string | number | null;
  jednostka?: string | null;
  cena_netto?: number | null;
  wartosc_netto?: number | null;
};
type OcrPodsumowanie = {
  netto?: number | null;
  vat?: number | null;
  brutto?: number | null;
  waluta?: string | null;
};
type OcrStatyka = {
  norma?: string | null;
  strefa?: string | null;
  teren?: string | null;
  budynek_z?: string | null;
  pk?: string | null;
};
type OcrZakresOferty = {
  zawiera?: string[] | null;
  systemy_aluminiowe?: Array<{ producent?: string | null; system?: string | null }> | null;
  ilosc_pozycji?: number | null;
  ilosc_konstrukcji?: number | null;
  calkowita_powierzchnia_m2?: number | null;
  calkowity_obwod_m?: number | null;
  kolor_profili?: string | null;
  kolor_okuc?: string | null;
  szyby_rodzaje?: string[] | null;
  statyka?: OcrStatyka | null;
};
type OcrJson = {
  dokument?: OcrDokument;
  dostawca?: OcrStrona;
  odbiorca?: OcrStrona;
  zakres_oferty?: OcrZakresOferty | null;
  pozycje?: OcrPozycja[];
  podsumowanie?: OcrPodsumowanie;
  uwagi?: string | null;
  dodatkowe?: Record<string, unknown> | null;
  raw?: string;
};

function formatCurrency(val: number | null | undefined, waluta?: string | null) {
  if (val == null) return <span className="ocr-view-val-null">—</span>;
  return `${val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${waluta ?? "PLN"}`;
}

function Val({ v }: { v: string | number | null | undefined }) {
  if (v == null || v === "") return <span className="ocr-view-val-null">—</span>;
  return <span className="ocr-view-val">{String(v)}</span>;
}

function OcrResultView({ data }: { data: OcrJson }) {
  if (data.raw) {
    return (
      <pre className="ocr-result-pre">{data.raw}</pre>
    );
  }

  const { dokument, dostawca, odbiorca, zakres_oferty, pozycje, podsumowanie, uwagi, dodatkowe } = data;
  const waluta = podsumowanie?.waluta;

  return (
    <div className="ocr-view">
      {dokument && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Dokument</div>
          <div className="ocr-view-doc-fields">
            {dokument.numer != null && (
              <div className="ocr-view-doc-field">
                <span className="ocr-view-key">Numer</span>
                <Val v={dokument.numer} />
              </div>
            )}
            {dokument.data != null && (
              <div className="ocr-view-doc-field">
                <span className="ocr-view-key">Data</span>
                <Val v={dokument.data} />
              </div>
            )}
            {dokument.tytul != null && (
              <div className="ocr-view-doc-field">
                <span className="ocr-view-key">Tytuł</span>
                <Val v={dokument.tytul} />
              </div>
            )}
          </div>
        </div>
      )}

      {(dostawca ?? odbiorca) && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Strony</div>
          <div className="ocr-view-grid-2">
            {dostawca && (
              <div className="ocr-view-card">
                <div className="ocr-view-card-title">Dostawca</div>
                <div className="ocr-view-field">
                  <span className="ocr-view-key">Nazwa</span>
                  <Val v={dostawca.nazwa} />
                </div>
                <div className="ocr-view-field">
                  <span className="ocr-view-key">NIP</span>
                  <Val v={dostawca.nip} />
                </div>
                <div className="ocr-view-field">
                  <span className="ocr-view-key">Adres</span>
                  <Val v={dostawca.adres} />
                </div>
              </div>
            )}
            {odbiorca && (
              <div className="ocr-view-card">
                <div className="ocr-view-card-title">Odbiorca</div>
                <div className="ocr-view-field">
                  <span className="ocr-view-key">Nazwa</span>
                  <Val v={odbiorca.nazwa} />
                </div>
                <div className="ocr-view-field">
                  <span className="ocr-view-key">NIP</span>
                  <Val v={odbiorca.nip} />
                </div>
                <div className="ocr-view-field">
                  <span className="ocr-view-key">Adres</span>
                  <Val v={odbiorca.adres} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {pozycje && pozycje.length > 0 && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Pozycje ({pozycje.length})</div>
          <table className="ocr-view-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>Lp.</th>
                <th>Opis</th>
                <th className="num" style={{ width: 60 }}>Ilość</th>
                <th style={{ width: 40 }}>Jm.</th>
                <th className="num" style={{ width: 90 }}>Cena netto</th>
                <th className="num" style={{ width: 90 }}>Wart. netto</th>
              </tr>
            </thead>
            <tbody>
              {pozycje.map((p, i) => (
                <tr key={i}>
                  <td>{p.lp ?? i + 1}</td>
                  <td>{p.opis ?? <span className="ocr-view-val-null">—</span>}</td>
                  <td className="num">{p.ilosc ?? <span className="ocr-view-val-null">—</span>}</td>
                  <td>{p.jednostka ?? <span className="ocr-view-val-null">—</span>}</td>
                  <td className="num">{formatCurrency(p.cena_netto, waluta)}</td>
                  <td className="num">{formatCurrency(p.wartosc_netto, waluta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podsumowanie && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Podsumowanie</div>
          <div className="ocr-view-summary">
            <div className="ocr-view-summary-row">
              <span className="ocr-view-summary-label">Netto</span>
              <span className="ocr-view-summary-val">{formatCurrency(podsumowanie.netto, waluta)}</span>
            </div>
            <div className="ocr-view-summary-row">
              <span className="ocr-view-summary-label">VAT</span>
              <span className="ocr-view-summary-val">{formatCurrency(podsumowanie.vat, waluta)}</span>
            </div>
            <hr className="ocr-view-summary-divider" />
            <div className="ocr-view-summary-row brutto">
              <span className="ocr-view-summary-label">Brutto</span>
              <span className="ocr-view-summary-val">{formatCurrency(podsumowanie.brutto, waluta)}</span>
            </div>
          </div>
        </div>
      )}

      {zakres_oferty && Object.values(zakres_oferty).some((v) => v != null) && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Zakres oferty</div>
          <div className="ocr-view-card" style={{ gap: 5 }}>
            {zakres_oferty.zawiera && zakres_oferty.zawiera.length > 0 && (
              <div className="ocr-view-field">
                <span className="ocr-view-key">Zawiera</span>
                <span className="ocr-view-val">{zakres_oferty.zawiera.join(", ")}</span>
              </div>
            )}
            {zakres_oferty.systemy_aluminiowe && zakres_oferty.systemy_aluminiowe.length > 0 && (
              <div className="ocr-view-field" style={{ alignItems: "flex-start" }}>
                <span className="ocr-view-key">Systemy</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {zakres_oferty.systemy_aluminiowe.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      {s.system && <span className="ocr-view-val">{s.system}</span>}
                      {s.producent && <span className="ocr-view-val-null">{s.producent}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 16px", marginTop: 4 }}>
              {zakres_oferty.ilosc_pozycji != null && (
                <div className="ocr-view-doc-field">
                  <span className="ocr-view-key">Poz.</span>
                  <Val v={zakres_oferty.ilosc_pozycji} />
                </div>
              )}
              {zakres_oferty.ilosc_konstrukcji != null && (
                <div className="ocr-view-doc-field">
                  <span className="ocr-view-key">Konstr.</span>
                  <Val v={zakres_oferty.ilosc_konstrukcji} />
                </div>
              )}
              {zakres_oferty.calkowita_powierzchnia_m2 != null && (
                <div className="ocr-view-doc-field">
                  <span className="ocr-view-key">Pow. m²</span>
                  <Val v={zakres_oferty.calkowita_powierzchnia_m2} />
                </div>
              )}
              {zakres_oferty.calkowity_obwod_m != null && (
                <div className="ocr-view-doc-field">
                  <span className="ocr-view-key">Obwód m</span>
                  <Val v={zakres_oferty.calkowity_obwod_m} />
                </div>
              )}
              {zakres_oferty.kolor_profili && (
                <div className="ocr-view-doc-field">
                  <span className="ocr-view-key">Kolor profili</span>
                  <Val v={zakres_oferty.kolor_profili} />
                </div>
              )}
              {zakres_oferty.kolor_okuc && (
                <div className="ocr-view-doc-field">
                  <span className="ocr-view-key">Kolor okuć</span>
                  <Val v={zakres_oferty.kolor_okuc} />
                </div>
              )}
            </div>
            {zakres_oferty.szyby_rodzaje && zakres_oferty.szyby_rodzaje.length > 0 && (
              <div className="ocr-view-field" style={{ marginTop: 4 }}>
                <span className="ocr-view-key">Szyby</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {zakres_oferty.szyby_rodzaje.map((s, i) => (
                    <span key={i} className="ocr-view-val">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {zakres_oferty.statyka && Object.values(zakres_oferty.statyka).some((v) => v != null) && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Statyka</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 16px" }}>
                  {zakres_oferty.statyka.norma && (
                    <div className="ocr-view-doc-field" style={{ gridColumn: "span 3" }}>
                      <span className="ocr-view-key">Norma</span>
                      <Val v={zakres_oferty.statyka.norma} />
                    </div>
                  )}
                  {zakres_oferty.statyka.strefa && (
                    <div className="ocr-view-doc-field">
                      <span className="ocr-view-key">Strefa</span>
                      <Val v={zakres_oferty.statyka.strefa} />
                    </div>
                  )}
                  {zakres_oferty.statyka.teren && (
                    <div className="ocr-view-doc-field">
                      <span className="ocr-view-key">Teren</span>
                      <Val v={zakres_oferty.statyka.teren} />
                    </div>
                  )}
                  {zakres_oferty.statyka.budynek_z && (
                    <div className="ocr-view-doc-field">
                      <span className="ocr-view-key">Wys. bud.</span>
                      <Val v={zakres_oferty.statyka.budynek_z} />
                    </div>
                  )}
                  {zakres_oferty.statyka.pk && (
                    <div className="ocr-view-doc-field">
                      <span className="ocr-view-key">pk</span>
                      <Val v={zakres_oferty.statyka.pk} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {uwagi && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Uwagi</div>
          <div className="ocr-view-notes">{uwagi}</div>
        </div>
      )}

      {dodatkowe && Object.keys(dodatkowe).length > 0 && (
        <div className="ocr-view-section">
          <div className="ocr-view-section-title">Pozostałe dane</div>
          <div className="ocr-view-card" style={{ gap: 4 }}>
            {Object.entries(dodatkowe).map(([key, val]) => (
              <div key={key} className="ocr-view-field">
                <span className="ocr-view-key" style={{ minWidth: 120 }}>{key.replace(/_/g, " ")}</span>
                <span className="ocr-view-val">
                  {Array.isArray(val)
                    ? val.join(", ")
                    : typeof val === "object" && val !== null
                      ? <pre className="ocr-result-pre" style={{ margin: 0, fontSize: 10 }}>{JSON.stringify(val, null, 2)}</pre>
                      : String(val ?? "—")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Quote = {
  _id: Id<"quotes">;
  sharepoint?: {
    status: "pending" | "created" | "failed";
    subfolderItemId?: string;
  };
};

type SpFile = {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function WycenaOcrSection({ quote }: { quote: Quote }) {
  const [files, setFiles] = useState<SpFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<Map<string, string>>(new Map());

  const listFiles = useAction(api.sharepoint.listWycenaSubfolderFiles);
  const runOcr = useAction(api.sharepoint.runOcrForFile);
  const deleteResult = useMutation(api.quoteOcr.deleteResult);
  const ocrResults = useQuery(api.quoteOcr.listByQuote, { quoteId: quote._id });

  const hasFolder = quote.sharepoint?.status === "created";

  async function loadFiles() {
    setIsLoadingFiles(true);
    setFilesError(null);
    try {
      const result = await listFiles({ quoteId: quote._id });
      setFiles(result);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : "Błąd pobierania plików");
    } finally {
      setIsLoadingFiles(false);
    }
  }

  useEffect(() => {
    if (hasFolder) void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFolder, quote._id]);

  async function handleRunOcr(file: SpFile) {
    setProcessingIds((prev) => new Set(prev).add(file.id));
    setFileErrors((prev) => {
      const next = new Map(prev);
      next.delete(file.id);
      return next;
    });
    try {
      await runOcr({
        quoteId: quote._id,
        fileItemId: file.id,
        fileName: file.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd OCR";
      setFileErrors((prev) => new Map(prev).set(file.id, msg));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  }

  async function handleDeleteResult(resultId: Id<"quoteOcrResults">) {
    await deleteResult({ id: resultId });
  }

  if (!hasFolder) {
    return (
      <div className="quote-detail-stack">
        <section className="quote-detail-section">
          <header className="quote-detail-section-head">
            <div className="quote-detail-section-title">
              <span className="quote-detail-section-icon">
                <I.doc s={14} />
              </span>
              <span>OCR dokumentów</span>
            </div>
          </header>
          <div className="quote-detail-section-body">
            <div className="quote-detail-empty">
              <div className="quote-detail-empty-text">
                Folder SharePoint nie jest jeszcze gotowy. Poczekaj na jego
                utworzenie.
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="quote-detail-stack">
      <section className="quote-detail-section">
        <header className="quote-detail-section-head">
          <div className="quote-detail-section-title">
            <span className="quote-detail-section-icon">
              <I.doc s={14} />
            </span>
            <span>OCR dokumentów</span>
          </div>
          <div className="quote-detail-section-action">
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => void loadFiles()}
              disabled={isLoadingFiles}
            >
              <I.refresh s={13} />
              Odśwież
            </button>
          </div>
        </header>
        <div className="quote-detail-section-body">
          {isLoadingFiles && (
            <div className="quote-detail-empty">
              <div className="quote-detail-empty-text">Ładowanie plików…</div>
            </div>
          )}

          {filesError && !isLoadingFiles && (
            <div className="quote-detail-empty">
              <div className="quote-detail-empty-text" style={{ color: "oklch(0.6 0.18 25)" }}>
                {filesError}
              </div>
            </div>
          )}

          {!isLoadingFiles && !filesError && files.length === 0 && (
            <div className="quote-detail-empty">
              <div className="quote-detail-empty-title">Brak plików PDF</div>
              <div className="quote-detail-empty-text">
                Dodaj pliki PDF ręcznie do podfolderu{" "}
                <strong>Wycena</strong> w folderze tej wyceny na SharePoint,
                a następnie kliknij Odśwież.
              </div>
            </div>
          )}

          {!isLoadingFiles && files.length > 0 && (
            <div className="ocr-file-list">
              {files.map((file) => {
                const result = ocrResults?.find(
                  (r) => r.fileItemId === file.id,
                );
                const isProcessing = processingIds.has(file.id);
                const fileError = fileErrors.get(file.id);

                return (
                  <div key={file.id} className="ocr-file-item">
                    <div className="ocr-file-row">
                      <span className="ocr-file-icon">
                        <I.doc s={16} />
                      </span>
                      <div className="ocr-file-meta">
                        <div className="ocr-file-name">{file.name}</div>
                        <div className="ocr-file-info">
                          {formatFileSize(file.size)} ·{" "}
                          {formatDate(file.lastModifiedDateTime)}
                        </div>
                      </div>
                      <div className="ocr-file-actions">
                        {isProcessing ? (
                          <span className="ocr-spinner" />
                        ) : result ? (
                          <button
                            type="button"
                            className="fluent-btn fluent-btn-ghost"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            onClick={() => void handleRunOcr(file)}
                          >
                            <I.refresh s={13} />
                            Ponów OCR
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="fluent-btn fluent-btn-primary"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            onClick={() => void handleRunOcr(file)}
                          >
                            <I.glass s={13} />
                            Uruchom OCR
                          </button>
                        )}
                      </div>
                    </div>

                    {fileError && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "oklch(0.6 0.18 25)",
                          padding: "4px 0 0",
                        }}
                      >
                        {fileError}
                      </div>
                    )}

                    {result && (
                      <div className="ocr-result-block">
                        <div className="ocr-result-head">
                          <span className="ocr-result-label">
                            Wynik OCR ·{" "}
                            {new Date(result.processedAt).toLocaleString(
                              "pl-PL",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                          <button
                            type="button"
                            className="fluent-btn fluent-btn-ghost"
                            style={{ fontSize: 11, padding: "2px 8px" }}
                            onClick={() => void handleDeleteResult(result._id)}
                            title="Usuń wynik OCR"
                          >
                            <I.trash s={12} />
                          </button>
                        </div>
                        <OcrResultView data={result.ocrJson as OcrJson} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
