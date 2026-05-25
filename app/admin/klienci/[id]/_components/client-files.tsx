"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

type SpItem = {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
  isFolder: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

export function ClientFiles({ client }: { client: Doc<"clients"> }) {
  const [items, setItems] = useState<SpItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ fileId: string; fileName: string } | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listFiles = useAction(api.sharepoint.listClientFiles);
  const createSession = useAction(api.sharepoint.createClientUploadSession);
  const getFileContent = useAction(api.sharepoint.getClientFileForPreview);

  const sp = client.sharepointFolder;
  const hasFolder = sp?.status === "created" && !!sp.itemId;

  async function loadFiles() {
    if (!hasFolder) return;
    setIsLoading(true);
    try {
      const result = await listFiles({ clientId: client._id });
      setItems(result);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFolder) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client._id, hasFolder]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  async function handleUpload(file: File) {
    if (isUploading) return;
    setIsUploading(true);
    try {
      const { uploadUrl } = await createSession({
        clientId: client._id,
        fileName: file.name,
      });
      const headers: Record<string, string> = { "Content-Length": String(file.size) };
      if (file.size > 0) {
        headers["Content-Range"] = `bytes 0-${file.size - 1}/${file.size}`;
      }
      const res = await fetch(uploadUrl, { method: "PUT", headers, body: file });
      if (!res.ok && res.status !== 201) throw new Error(`Upload ${res.status}`);
      await loadFiles();
    } catch (e) {
      console.error("[client upload]", e);
    } finally {
      setIsUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  }
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = "";
  }

  async function openPdfPreview(file: SpItem) {
    setPdfPreview({ fileId: file.id, fileName: file.name });
    setPdfBlobUrl(null);
    setIsLoadingPdf(true);
    setPdfError(null);
    try {
      const { base64, contentType } = await getFileContent({
        clientId: client._id,
        fileId: file.id,
      });
      const blob = base64ToBlob(base64, contentType);
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Błąd podglądu");
    } finally {
      setIsLoadingPdf(false);
    }
  }

  async function downloadFile(file: SpItem) {
    try {
      const { base64, contentType } = await getFileContent({
        clientId: client._id,
        fileId: file.id,
      });
      const blob = base64ToBlob(base64, contentType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[client download]", e);
    }
  }

  function closePdfPreview() {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfPreview(null);
    setPdfBlobUrl(null);
    setPdfError(null);
  }

  if (!hasFolder) {
    return (
      <section className="client-detail-section">
        <header className="client-detail-section-head">
          <div className="client-detail-section-title">
            <I.paperclip s={14} />
            <span>Pliki klienta</span>
          </div>
        </header>
        <div className="quote-detail-files-no-folder">
          <I.paperclip s={20} />
          <div className="quote-detail-files-no-folder-title">
            Brak folderu klienta na SharePoint
          </div>
          <div className="quote-detail-files-no-folder-hint">
            Użyj przycisku „Utwórz folder na SharePoint” w nagłówku, aby
            założyć folder klienta.
          </div>
        </div>
      </section>
    );
  }

  const filesOnly = items.filter((it) => !it.isFolder);
  const subfolders = items.filter((it) => it.isFolder);

  return (
    <section className="client-detail-section">
      <header className="client-detail-section-head">
        <div className="client-detail-section-title">
          <I.paperclip s={14} />
          <span>Pliki klienta</span>
          <span className="client-detail-section-sub">
            · folder na SharePoint (poziom klienta)
          </span>
        </div>
        <button
          className="quote-detail-files-refresh"
          onClick={() => void loadFiles()}
          disabled={isLoading}
          title="Odśwież"
        >
          <I.refresh s={14} />
        </button>
      </header>

      {subfolders.length > 0 && (
        <div className="client-detail-subfolders">
          <div className="client-detail-subfolders-label">Podfoldery wycen</div>
          <div className="client-detail-subfolders-list">
            {subfolders.map((f) => (
              <span key={f.id} className="client-detail-subfolder-chip">
                <I.box s={11} />
                <span>{f.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading && filesOnly.length === 0 && (
        <div className="quote-detail-files-empty">Ładowanie plików…</div>
      )}

      {!isLoading && filesOnly.length === 0 && (
        <div className="quote-detail-files-empty">
          Brak plików na poziomie klienta. Przeciągnij plik poniżej, aby dodać.
        </div>
      )}

      {filesOnly.length > 0 && (
        <table className="quote-detail-files-table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Rozmiar</th>
              <th>Data modyfikacji</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filesOnly.map((file) => {
              const isPdf =
                file.mimeType === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");
              return (
                <tr key={file.id} className="quote-detail-files-row">
                  <td className="quote-detail-files-name">
                    {isPdf ? (
                      <button
                        className="quote-detail-files-name-btn"
                        onClick={() => void openPdfPreview(file)}
                      >
                        <I.doc s={13} />
                        <span>{file.name}</span>
                      </button>
                    ) : (
                      <span className="quote-detail-files-name-text">
                        <I.doc s={13} />
                        <span>{file.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="quote-detail-files-size">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="quote-detail-files-date">
                    {formatFileDate(file.lastModifiedDateTime)}
                  </td>
                  <td className="quote-detail-files-actions">
                    <button
                      className="quote-detail-files-action-btn"
                      onClick={() => void downloadFile(file)}
                      title="Pobierz"
                    >
                      <I.download s={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div
        className={`quote-detail-dropzone${isDragging ? " active" : ""}${
          isUploading ? " uploading" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{ cursor: isUploading ? "default" : "pointer" }}
      >
        {isUploading ? (
          <>
            <I.refresh s={20} />
            <div className="quote-detail-dropzone-title">Wysyłanie…</div>
          </>
        ) : (
          <>
            <I.download s={20} />
            <div className="quote-detail-dropzone-title">
              {isDragging ? "Upuść plik tutaj" : "Przeciągnij plik tutaj"}
            </div>
            <div className="quote-detail-dropzone-text">
              Lub kliknij, aby wybrać plik z dysku
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
      </div>

      {pdfPreview && (
        <>
          <div className="pdf-drawer-overlay" onClick={closePdfPreview} />
          <div className="pdf-drawer">
            <div className="pdf-drawer-header">
              <span className="pdf-drawer-filename">{pdfPreview.fileName}</span>
              <button className="pdf-drawer-close" onClick={closePdfPreview}>
                <I.x s={16} />
              </button>
            </div>
            <div className="pdf-drawer-body">
              {isLoadingPdf && (
                <div className="pdf-drawer-state">Ładowanie podglądu…</div>
              )}
              {pdfError && (
                <div className="pdf-drawer-state pdf-drawer-error">
                  {pdfError}
                </div>
              )}
              {pdfBlobUrl && (
                <iframe
                  src={pdfBlobUrl}
                  className="pdf-drawer-iframe"
                  title={pdfPreview.fileName}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
