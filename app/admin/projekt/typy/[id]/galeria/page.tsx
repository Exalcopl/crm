"use client";

import { use, useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../../../_lib/icons";
import { hexToTypeStyle } from "../../../../_lib/quotes";
import "../../../../users/users.css";
import "./gallery.css";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type GalleryImage = {
  _id: Id<"projectTypeGalleryImages">;
  storageId: Id<"_storage">;
  fileName: string;
  contentType: string;
  order: number;
  url: string | null;
};

/* ---- Image compression utility ---- */
function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If it's not an image that can be drawn to canvas, return as-is
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Kompresja nie powiodła się"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się wczytać zdjęcia"));
    };
    img.src = url;
  });
}

/* ---- Sortable image card ---- */
function SortableImageCard({
  image,
  onDelete,
}: {
  image: GalleryImage;
  onDelete: (img: GalleryImage) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="gallery-card">
      <div className="gallery-card-handle" {...attributes} {...listeners}>
        {I.grip({ s: 16 })}
      </div>
      {image.url ? (
        <img
          src={image.url}
          alt={image.fileName}
          className="gallery-card-img"
          draggable={false}
        />
      ) : (
        <div className="gallery-card-img gallery-card-placeholder">
          Brak podglądu
        </div>
      )}
      <div className="gallery-card-footer">
        <span className="gallery-card-name" title={image.fileName}>
          {image.fileName}
        </span>
        <button
          type="button"
          className="gallery-card-delete"
          onClick={() => onDelete(image)}
          title="Usuń zdjęcie"
        >
          {I.trash({ s: 14 })}
        </button>
      </div>
    </div>
  );
}

/* ---- Image card for drag overlay ---- */
function ImageOverlay({ image }: { image: GalleryImage }) {
  return (
    <div className="gallery-card gallery-card-overlay">
      {image.url ? (
        <img
          src={image.url}
          alt={image.fileName}
          className="gallery-card-img"
          draggable={false}
        />
      ) : (
        <div className="gallery-card-img gallery-card-placeholder">
          Brak podglądu
        </div>
      )}
      <div className="gallery-card-footer">
        <span className="gallery-card-name">{image.fileName}</span>
      </div>
    </div>
  );
}

/* ---- Confirm delete modal ---- */
function ConfirmDeleteModal({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-head">
          <h2>Usuń zdjęcie</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            aria-label="Zamknij"
          >
            {I.x({ s: 14 })}
          </button>
        </div>
        <div className="users-modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)" }}>
            Czy na pewno chcesz usunąć zdjęcie <strong>{fileName}</strong>?
          </p>
          <p className="users-modal-info">Tej operacji nie można cofnąć.</p>
        </div>
        <div className="users-modal-foot">
          <button
            type="button"
            className="users-btn users-btn-ghost"
            onClick={onCancel}
            autoFocus
          >
            Nie
          </button>
          <button
            type="button"
            className="users-btn users-btn-ghost"
            onClick={onConfirm}
            style={{ color: "#ffb4af" }}
          >
            {I.trash({ s: 14 })} Tak, usuń
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Main page ---- */
export default function ProjectTypeGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectTypeId = id as Id<"projectTypes">;

  const projectType = useQuery(api.projectTypes.get, { id: projectTypeId });
  const rawImages = useQuery(api.projectTypeGallery.listByType, {
    projectTypeId,
  });
  const images = (rawImages ?? []) as GalleryImage[];

  const generateUploadUrl = useMutation(
    api.projectTypeGallery.generateUploadUrl
  );
  const addImageMutation = useMutation(api.projectTypeGallery.addImage);
  const removeImageMutation = useMutation(api.projectTypeGallery.removeImage);
  const reorderMutation = useMutation(api.projectTypeGallery.reorderImages);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GalleryImage | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<GalleryImage[] | null>(null);

  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dndId = useId();
  const isDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Use local order while dragging, otherwise use server data
  const displayImages = localOrder ?? images;

  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 
    process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site") || "";
  const jsonUrl = siteUrl ? `${siteUrl}/api/gallery/${encodeURIComponent(projectType?.name || "")}` : "";

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploading(true);
      setError("");
      setUploadProgress({ current: 0, total: files.length });

      try {
        for (let i = 0; i < files.length; i++) {
          setUploadProgress({ current: i + 1, total: files.length });

          const file = files[i];

          // Validate file type
          if (!file.type.startsWith("image/")) {
            setError(`Plik "${file.name}" nie jest obrazem — pominięto.`);
            continue;
          }

          // Compress image
          const compressed = await compressImage(file);

          // Get upload URL
          const uploadUrl = await generateUploadUrl();

          // Upload to Convex storage
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: compressed,
          });

          if (!result.ok) {
            throw new Error(`Upload nie powiódł się dla: ${file.name}`);
          }

          const { storageId } = await result.json();

          // Save reference in DB
          await addImageMutation({
            projectTypeId,
            storageId,
            fileName: file.name,
            contentType: "image/jpeg",
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Nieznany błąd podczas uploadu"
        );
      } finally {
        setUploading(false);
        setUploadProgress(null);
        // Reset input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [generateUploadUrl, addImageMutation, projectTypeId]
  );

  const handleDelete = useCallback(
    async (img: GalleryImage) => {
      try {
        await removeImageMutation({ id: img._id });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Nieznany błąd przy usuwaniu"
        );
      } finally {
        setDeleteTarget(null);
      }
    },
    [removeImageMutation]
  );

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    setActiveId(event.active.id as string);
    setLocalOrder([...images]);
  }

  function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) {
      setLocalOrder(null);
      return;
    }

    const currentOrder = localOrder ?? images;
    const oldIndex = currentOrder.findIndex((img) => img._id === active.id);
    const newIndex = currentOrder.findIndex((img) => img._id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setLocalOrder(null);
      return;
    }

    const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
    setLocalOrder(newOrder);

    // Save to backend
    void reorderMutation({
      projectTypeId,
      imageIds: newOrder.map((img) => img._id),
    }).then(() => {
      setLocalOrder(null);
    });
  }

  function handleDragCancel() {
    isDraggingRef.current = false;
    setActiveId(null);
    setLocalOrder(null);
  }

  const activeImage = activeId
    ? displayImages.find((img) => img._id === activeId)
    : null;

  // Loading state
  if (projectType === undefined) {
    return (
      <main className="users-content">
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Ładowanie…
        </div>
      </main>
    );
  }

  // Not found
  if (projectType === null) {
    return (
      <main className="users-content">
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Typ projektu nie istnieje.{" "}
          <Link href="/admin/projekt/typy">← Wróć do listy typów</Link>
        </div>
      </main>
    );
  }

  const typeStyle = hexToTypeStyle(projectType.color);

  return (
    <main className="users-content">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/admin/projekt/typy"
          className="users-btn users-btn-ghost"
          style={{ padding: "5px 10px" }}
        >
          ← Typy projektów
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Galeria</h1>
          <span
            className="kanban-chip kanban-chip-type"
            style={{
              background: typeStyle.bg,
              color: typeStyle.fg,
              borderColor: typeStyle.border,
            }}
          >
            <span
              className="kanban-chip-dot"
              style={{ background: typeStyle.fg }}
            />
            {projectType.name}
          </span>
        </div>
      </div>

      {jsonUrl && (
        <div style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "rgba(56, 139, 253, 0.1)",
          border: "1px solid rgba(56, 139, 253, 0.3)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12, color: "#58a6ff", fontWeight: 600, flexShrink: 0 }}>Publiczne API JSON:</span>
            <code style={{
              fontSize: 11,
              fontFamily: "monospace",
              background: "rgba(0, 0, 0, 0.2)",
              padding: "4px 8px",
              borderRadius: 4,
              color: "#c9d1d9",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1
            }}>
              {jsonUrl}
            </code>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={jsonUrl}
              target="_blank"
              rel="noreferrer"
              className="users-btn users-btn-ghost"
              style={{ padding: "4px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              {I.link({ s: 12 })} Otwórz API
            </a>
            <button
              type="button"
              className="users-btn"
              onClick={() => {
                navigator.clipboard.writeText(jsonUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                background: copied ? "#2ea44f" : "var(--btn-primary-bg, #21262d)",
                color: "#fff",
                border: "1px solid var(--border-primary, #30363d)",
                borderRadius: 6,
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
            >
              {copied ? "Skopiowano!" : "Kopiuj link"}
            </button>
          </div>
        </div>
      )}

      <div className="users-toolbar">
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Zarządzaj zdjęciami galerii dla tego typu projektu. Przeciągnij
          miniaturki aby zmienić kolejność. Zdjęcia są dostępne publicznie przez
          API.
        </div>
        <div style={{ flex: 1 }} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
          id="gallery-file-input"
        />
        <button
          type="button"
          className="users-btn users-btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {I.plus({ s: 14 })}{" "}
          {uploading
            ? `Wysyłanie (${uploadProgress?.current}/${uploadProgress?.total})…`
            : "Dodaj zdjęcia"}
        </button>
      </div>

      {error && (
        <div
          className="users-error"
          style={{ marginBottom: 16, cursor: "pointer" }}
          onClick={() => setError("")}
        >
          {error}
        </div>
      )}

      {uploading && uploadProgress && (
        <div className="gallery-progress">
          <div
            className="gallery-progress-bar"
            style={{
              width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
            }}
          />
        </div>
      )}

      {displayImages.length === 0 && !uploading ? (
        <div className="gallery-empty">
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>🖼</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Brak zdjęć. Kliknij <strong>Dodaj zdjęcia</strong>, aby dodać
            pierwsze.
          </div>
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={displayImages.map((img) => img._id)}
            strategy={rectSortingStrategy}
          >
            <div className="gallery-grid">
              {displayImages.map((img) => (
                <SortableImageCard
                  key={img._id}
                  image={img}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeImage ? <ImageOverlay image={activeImage} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          fileName={deleteTarget.fileName}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
