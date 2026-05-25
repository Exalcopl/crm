"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  MAX_FILES,
  formatFileSize,
  getExtension,
  isImage,
  validateFiles,
  type FileValidationError,
} from "@/app/_lib/file-types";

function fileError(e: FileValidationError): string {
  if (e.kind === "tooLarge") return `${e.name} — większy niż 20 MB`;
  if (e.kind === "badType") return `${e.name} — nieobsługiwany typ`;
  return `${e.count} plików ponad limit ${MAX_FILES}`;
}

export function FilePicker({
  files,
  onChange,
  disabled = false,
  variant = "default",
}: {
  files: File[];
  onChange: (next: File[]) => void;
  disabled?: boolean;
  variant?: "default" | "public";
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<FileValidationError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs dla miniaturek obrazów
  const previews = useMemo(() => {
    const map = new Map<File, string>();
    for (const f of files) {
      if (isImage(f.name)) {
        map.set(f, URL.createObjectURL(f));
      }
    }
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, [previews]);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const { accepted, errors: errs } = validateFiles(files.length, arr, {
      maxFiles: MAX_FILES,
      maxSizeBytes: MAX_FILE_BYTES,
    });
    setErrors(errs);
    if (accepted.length > 0) onChange([...files, ...accepted]);
  }

  function removeAt(idx: number) {
    const next = files.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  }
  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  const remaining = MAX_FILES - files.length;
  const dropClass =
    variant === "public" ? "fp-dropzone fp-dropzone-public" : "fp-dropzone";

  return (
    <div className="fp-root">
      <div
        className={`${dropClass}${isDragging ? " is-dragging" : ""}${
          disabled ? " is-disabled" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <div className="fp-dropzone-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3v12m0-12L7 8m5-5l5 5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="fp-dropzone-title">
          {isDragging
            ? "Upuść pliki tutaj"
            : files.length === 0
              ? "Przeciągnij pliki lub kliknij, aby wybrać"
              : `Dodaj kolejne pliki (zostało ${remaining})`}
        </div>
        <div className="fp-dropzone-hint">
          PNG, JPG, PDF, DWG, DXF · max 20 MB / plik · do {MAX_FILES} plików
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          style={{ display: "none" }}
          onChange={onInput}
          disabled={disabled}
        />
      </div>

      {errors.length > 0 && (
        <ul className="fp-errors">
          {errors.map((e, i) => (
            <li key={i}>{fileError(e)}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="fp-list">
          {files.map((f, i) => {
            const ext = getExtension(f.name);
            const preview = previews.get(f);
            return (
              <li key={`${f.name}-${i}`} className="fp-item">
                <div className="fp-item-thumb" aria-hidden="true">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="fp-item-img" />
                  ) : (
                    <span className="fp-item-ext">{ext || "•"}</span>
                  )}
                </div>
                <div className="fp-item-body">
                  <div className="fp-item-name" title={f.name}>
                    {f.name}
                  </div>
                  <div className="fp-item-meta">{formatFileSize(f.size)}</div>
                </div>
                <button
                  type="button"
                  className="fp-item-remove"
                  onClick={() => removeAt(i)}
                  disabled={disabled}
                  aria-label={`Usuń ${f.name}`}
                  title="Usuń"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
