"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

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
                        <pre className="ocr-result-pre">
                          {JSON.stringify(result.ocrJson, null, 2)}
                        </pre>
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
