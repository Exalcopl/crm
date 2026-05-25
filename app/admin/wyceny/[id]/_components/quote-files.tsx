"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  MAX_FILES,
  formatFileSize,
  getExtension,
  isImage,
  isPdf,
  validateFiles,
} from "@/app/_lib/file-types";

type Quote = {
  _id: Id<"quotes">;
  sharepoint?: {
    status: "pending" | "created" | "failed";
    subfolderItemId?: string;
    webUrl?: string;
  };
};

type SpFile = {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
};

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

export function QuoteFiles({
  quote,
  archived,
}: {
  quote: Quote;
  archived?: boolean;
}) {
  const [files, setFiles] = useState<SpFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploads, setUploads] = useState<
    { name: string; progress: number; error?: string }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{
    file: SpFile;
    blobUrl: string | null;
    error: string | null;
    loading: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listFiles = useAction(api.sharepoint.listQuoteFiles);
  const createSession = useAction(api.sharepoint.createUploadSession);
  const getFileContent = useAction(api.sharepoint.getFileForPreview);

  const hasFolder =
    quote.sharepoint?.status === "created" &&
    !!quote.sharepoint.subfolderItemId;

  async function loadFiles() {
    if (!hasFolder) return;
    setIsLoading(true);
    try {
      const result = await listFiles({ quoteId: quote._id });
      setFiles(result);
    } catch (e) {
      console.error("[quote-files]", e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFolder) return;
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote._id, hasFolder]);

  useEffect(() => {
    return () => {
      if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    };
  }, [preview?.blobUrl]);

  async function uploadOne(file: File): Promise<void> {
    setUploads((u) => [...u, { name: file.name, progress: 0 }]);
    try {
      const { uploadUrl } = await createSession({
        quoteId: quote._id,
        fileName: file.name,
      });
      const headers: Record<string, string> = {
        "Content-Length": String(file.size),
      };
      if (file.size > 0) {
        headers["Content-Range"] = `bytes 0-${file.size - 1}/${file.size}`;
      }
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: file,
      });
      if (!res.ok && res.status !== 201) {
        throw new Error(`Upload ${res.status}`);
      }
      setUploads((u) =>
        u.map((it) =>
          it.name === file.name ? { ...it, progress: 100 } : it,
        ),
      );
    } catch (e) {
      setUploads((u) =>
        u.map((it) =>
          it.name === file.name
            ? { ...it, error: e instanceof Error ? e.message : "Błąd" }
            : it,
        ),
      );
    }
  }

  async function handleFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    const { accepted, errors } = validateFiles(files.length, arr, {
      maxFiles: MAX_FILES,
      maxSizeBytes: MAX_FILE_BYTES,
    });
    if (errors.length > 0) {
      // Pokaż w jednym toście; nie blokuj akceptowanych
      for (const err of errors) {
        if (err.kind === "tooLarge") {
          console.warn(`Plik ${err.name} > 20 MB`);
        } else if (err.kind === "badType") {
          console.warn(`Plik ${err.name} ma nieobsługiwany typ`);
        }
      }
    }
    if (accepted.length === 0) return;
    setUploads([]);
    await Promise.all(accepted.map((f) => uploadOne(f)));
    await loadFiles();
    setTimeout(() => setUploads([]), 1500);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!archived) setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (archived) return;
    void handleFiles(e.dataTransfer.files);
  }
  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void handleFiles(e.target.files);
    e.target.value = "";
  }

  async function openPreview(f: SpFile) {
    if (!isImage(f.name) && !isPdf(f.name)) return;
    if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview({ file: f, blobUrl: null, error: null, loading: true });
    try {
      const { base64, contentType } = await getFileContent({
        quoteId: quote._id,
        fileId: f.id,
      });
      const blob = base64ToBlob(base64, contentType);
      setPreview({
        file: f,
        blobUrl: URL.createObjectURL(blob),
        error: null,
        loading: false,
      });
    } catch (e) {
      setPreview({
        file: f,
        blobUrl: null,
        error: e instanceof Error ? e.message : "Błąd podglądu",
        loading: false,
      });
    }
  }

  function closePreview() {
    if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  }

  if (!hasFolder) {
    return (
      <section className="quote-detail-section">
        <header className="quote-detail-section-head">
          <div className="quote-detail-section-title">
            <span className="quote-detail-section-icon">
              <I.paperclip s={14} />
            </span>
            <span>Pliki</span>
          </div>
        </header>
        <div className="quote-detail-section-body">
          <div className="quote-detail-files-no-folder">
            <I.paperclip s={20} />
            <div className="quote-detail-files-no-folder-title">
              Brak folderu SharePoint
            </div>
            <div className="quote-detail-files-no-folder-hint">
              Folder zostanie utworzony automatycznie. Jeśli się nie pojawia,
              użyj przycisku „Ponów” w sekcji SharePoint.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const images = files.filter((f) => isImage(f.name) || isImage(f.mimeType));
  const docs = files.filter((f) => !isImage(f.name) && !isImage(f.mimeType));

  return (
    <section className="quote-detail-section">
      <header className="quote-detail-section-head">
        <div className="quote-detail-section-title">
          <span className="quote-detail-section-icon">
            <I.paperclip s={14} />
          </span>
          <span>Pliki</span>
          <span className="quote-files-count">
            {files.length === 0 ? "" : `${files.length}`}
          </span>
        </div>
        <div className="quote-detail-section-action">
          <button
            type="button"
            className="quote-detail-files-refresh"
            onClick={() => void loadFiles()}
            disabled={isLoading}
            title="Odśwież"
          >
            <I.refresh s={14} />
          </button>
        </div>
      </header>

      <div className="quote-detail-section-body">
        {isLoading && files.length === 0 && (
          <div className="quote-files-empty">Ładowanie plików…</div>
        )}

        {!isLoading && files.length === 0 && uploads.length === 0 && (
          <div className="quote-files-empty">
            Brak plików. Przeciągnij pliki poniżej lub kliknij, aby wybrać.
          </div>
        )}

        {images.length > 0 && (
          <div className="quote-files-grid">
            {images.map((f) => (
              <button
                key={f.id}
                type="button"
                className="quote-files-thumb"
                onClick={() => void openPreview(f)}
                title={f.name}
              >
                <ThumbImage
                  quoteId={quote._id}
                  fileId={f.id}
                  fileName={f.name}
                  getFileContent={getFileContent}
                />
                <span className="quote-files-thumb-name">{f.name}</span>
              </button>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <ul className="quote-files-doclist">
            {docs.map((f) => {
              const ext = getExtension(f.name);
              const previewable = isPdf(f.name);
              return (
                <li key={f.id} className="quote-files-doc">
                  <span className="quote-files-doc-ext">{ext || "•"}</span>
                  <div className="quote-files-doc-body">
                    {previewable ? (
                      <button
                        type="button"
                        className="quote-files-doc-name as-link"
                        onClick={() => void openPreview(f)}
                      >
                        {f.name}
                      </button>
                    ) : (
                      <span className="quote-files-doc-name">{f.name}</span>
                    )}
                    <span className="quote-files-doc-meta">
                      {formatFileSize(f.size)} · {formatFileDate(f.lastModifiedDateTime)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {uploads.length > 0 && (
          <ul className="quote-files-uploads">
            {uploads.map((u, i) => (
              <li
                key={i}
                className={`quote-files-upload${u.error ? " has-error" : ""}`}
              >
                <span>{u.name}</span>
                <span className="quote-files-upload-status">
                  {u.error
                    ? u.error
                    : u.progress === 100
                      ? "Wysłano"
                      : "Wysyłanie…"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!archived && (
          <div
            className={`quote-detail-dropzone${isDragging ? " active" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: "pointer" }}
          >
            <I.download s={20} />
            <div className="quote-detail-dropzone-title">
              {isDragging
                ? "Upuść pliki tutaj"
                : "Przeciągnij pliki tutaj lub kliknij, aby wybrać"}
            </div>
            <div className="quote-detail-dropzone-text">
              PNG, JPG, PDF, DWG, DXF · max 20 MB / plik · do {MAX_FILES}{" "}
              plików
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              style={{ display: "none" }}
              onChange={onInput}
            />
          </div>
        )}
      </div>

      {preview && (
        <>
          <div className="pdf-drawer-overlay" onClick={closePreview} />
          <div className="pdf-drawer">
            <div className="pdf-drawer-header">
              <span className="pdf-drawer-filename">{preview.file.name}</span>
              <button className="pdf-drawer-close" onClick={closePreview}>
                <I.x s={16} />
              </button>
            </div>
            <div className="pdf-drawer-body">
              {preview.loading && (
                <div className="pdf-drawer-state">Ładowanie podglądu…</div>
              )}
              {preview.error && (
                <div className="pdf-drawer-state pdf-drawer-error">
                  {preview.error}
                </div>
              )}
              {preview.blobUrl && isPdf(preview.file.name) && (
                <iframe
                  src={preview.blobUrl}
                  className="pdf-drawer-iframe"
                  title={preview.file.name}
                />
              )}
              {preview.blobUrl && isImage(preview.file.name) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.blobUrl}
                  alt={preview.file.name}
                  className="quote-files-preview-img"
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ThumbImage({
  quoteId,
  fileId,
  fileName,
  getFileContent,
}: {
  quoteId: Id<"quotes">;
  fileId: string;
  fileName: string;
  getFileContent: ReturnType<typeof useAction<typeof api.sharepoint.getFileForPreview>>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const { base64, contentType } = await getFileContent({
          quoteId,
          fileId,
        });
        if (cancelled) return;
        const blob = base64ToBlob(base64, contentType);
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, fileId]);

  if (err) {
    return <span className="quote-files-thumb-fallback">?</span>;
  }
  if (!url) {
    return <span className="quote-files-thumb-loading" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={fileName} className="quote-files-thumb-img" />
  );
}
