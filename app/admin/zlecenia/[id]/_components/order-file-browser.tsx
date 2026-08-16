"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I, Icon } from "@/app/admin/_lib/icons";
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  formatFileSize,
  isImage,
  isPdf,
} from "@/app/_lib/file-types";

// ─── Types ───────────────────────────────────────────────────────────────────

type DriveItem = {
  id: string;
  name: string;
  isFolder: boolean;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
  childCount?: number;
};

type UploadItem = { name: string; progress: number; error?: string };

type PreviewState = {
  item: DriveItem;
  blobUrl: string | null;
  error: string | null;
  loading: boolean;
};

type OrderShape = {
  _id: Id<"orders">;
  sharepoint?: {
    status: "pending" | "created" | "failed";
    subfolderItemId?: string;
  };
};

type ListFn = (a: {
  orderId: Id<"orders">;
  folderId?: string;
}) => Promise<DriveItem[]>;

type UploadSessionFn = (a: {
  orderId: Id<"orders">;
  parentItemId: string;
  fileName: string;
}) => Promise<{ uploadUrl: string }>;

type CreateFolderFn = (a: {
  orderId: Id<"orders">;
  parentItemId: string;
  name: string;
}) => Promise<DriveItem>;

type DeleteFn = (a: {
  orderId: Id<"orders">;
  itemId: string;
}) => Promise<null | void>;

type PreviewFn = (a: {
  orderId: Id<"orders">;
  fileId: string;
}) => Promise<{ base64: string; contentType: string }>;

interface Actions {
  list: ListFn;
  uploadSession: UploadSessionFn;
  createFolder: CreateFolderFn;
  deleteItem: DeleteFn;
  getPreview: PreviewFn;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function b64ToBlob(base64: string, mt: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mt });
}

function canPreviewFile(name: string, mimeType: string) {
  return (
    isImage(name) ||
    isPdf(name) ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/")
  );
}

// ─── Inline icons ────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      className="text-muted-foreground"
      style={{ flexShrink: 0, display: "flex", width: 14 }}
    >
      <Icon s={13} sw={2}>
        {open ? (
          <path d="m6 9 6 6 6-6" />
        ) : (
          <path d="m9 18 6-6-6-6" />
        )}
      </Icon>
    </span>
  );
}

function FolderSvg({ open }: { open?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
      fill={open ? "#d97706" : "#f59e0b"}
      stroke="none"
    >
      <path d="M4 4h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function FileSvg({ name, mimeType }: { name: string; mimeType: string }) {
  const isPdfFile = isPdf(name) || mimeType === "application/pdf";
  const isImg = isImage(name) || mimeType.startsWith("image/");
  const color = isPdfFile ? "#ef4444" : isImg ? "#10b981" : "#6b7280";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
      fill={color}
      stroke="none"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
    </svg>
  );
}

// ─── FileRow ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  item: DriveItem;
  depth: number;
  archived?: boolean;
  onPreview: () => void;
  onDelete: () => void;
  confirming: boolean;
  onConfirmStart: () => void;
  onConfirmCancel: () => void;
  deleting: boolean;
}

function FileRow({
  item,
  depth,
  archived,
  onPreview,
  onDelete,
  confirming,
  onConfirmStart,
  onConfirmCancel,
  deleting,
}: FileRowProps) {
  const previewable = canPreviewFile(item.name, item.mimeType);
  const indent = depth * 16;

  return (
    <div
      className="flex items-center gap-1.5 py-[3px] pr-1 rounded group hover:bg-muted/50 text-sm"
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span style={{ width: 14, flexShrink: 0 }} />
      <FileSvg name={item.name} mimeType={item.mimeType} />

      {previewable ? (
        <button
          type="button"
          onClick={onPreview}
          className="truncate text-left hover:underline flex-1 min-w-0"
          title={item.name}
        >
          {item.name}
        </button>
      ) : (
        <span className="truncate flex-1 min-w-0" title={item.name}>
          {item.name}
        </span>
      )}

      <span className="text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100">
        {formatFileSize(item.size)}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100">
        {fmtDate(item.lastModifiedDateTime)}
      </span>

      {!archived && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {previewable && (
            <button
              type="button"
              title="Podgląd"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={onPreview}
            >
              <Icon s={13} sw={1.7}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </Icon>
            </button>
          )}
          {confirming ? (
            <>
              <button
                type="button"
                className="text-xs px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? "…" : "Usuń"}
              </button>
              <button
                type="button"
                className="text-xs px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground"
                onClick={onConfirmCancel}
              >
                Anuluj
              </button>
            </>
          ) : (
            <button
              type="button"
              title="Usuń plik"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              onClick={onConfirmStart}
            >
              <I.trash s={13} sw={1.6} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FolderNode ───────────────────────────────────────────────────────────────

interface FolderNodeProps {
  orderId: Id<"orders">;
  item: DriveItem;
  depth: number;
  archived?: boolean;
  actions: Actions;
  onPreview: (item: DriveItem) => void;
  onDeleteSelf: () => void;
}

function FolderNode({
  orderId,
  item,
  depth,
  archived,
  actions,
  onPreview,
  onDeleteSelf,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [contents, setContents] = useState<DriveItem[] | null>(null);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteSelf, setConfirmingDeleteSelf] = useState(false);
  const [deletingSelf, setDeletingSelf] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const loadContents = useCallback(async () => {
    setContentsLoading(true);
    try {
      const result = await actions.list({ orderId, folderId: item.id });
      setContents(result);
    } catch (e) {
      console.error("[folder-node] listContents:", e);
      setContents([]);
    } finally {
      setContentsLoading(false);
    }
  }, [orderId, item.id, actions]);

  function handleToggle() {
    if (!expanded && contents === null) {
      void loadContents();
    }
    setExpanded((v) => !v);
  }

  async function handleUpload(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.size <= MAX_FILE_BYTES);
    if (arr.length === 0) return;
    setUploads(arr.map((f) => ({ name: f.name, progress: 0 })));
    await Promise.all(
      arr.map(async (f) => {
        try {
          const { uploadUrl } = await actions.uploadSession({
            orderId,
            parentItemId: item.id,
            fileName: f.name,
          });
          const headers: Record<string, string> = {
            "Content-Length": String(f.size),
          };
          if (f.size > 0) {
            headers["Content-Range"] = `bytes 0-${f.size - 1}/${f.size}`;
          }
          const res = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: f,
          });
          if (!res.ok && res.status !== 201) throw new Error(`Upload ${res.status}`);
          setUploads((u) =>
            u.map((it) =>
              it.name === f.name ? { ...it, progress: 100 } : it,
            ),
          );
        } catch (e) {
          setUploads((u) =>
            u.map((it) =>
              it.name === f.name
                ? { ...it, error: e instanceof Error ? e.message : "Błąd" }
                : it,
            ),
          );
        }
      }),
    );
    await loadContents();
    setTimeout(() => setUploads([]), 2500);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await actions.createFolder({
        orderId,
        parentItemId: item.id,
        name: newFolderName.trim(),
      });
      setNewFolderName("");
      setShowNewFolder(false);
      await loadContents();
    } catch (e) {
      console.error("[folder-node] createFolder:", e);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteChild(childId: string) {
    setDeletingId(childId);
    try {
      await actions.deleteItem({ orderId, itemId: childId });
      await loadContents();
    } catch (e) {
      console.error("[folder-node] deleteChild:", e);
    } finally {
      setDeletingId(null);
      setConfirmingDeleteId(null);
    }
  }

  async function handleDeleteSelf() {
    setDeletingSelf(true);
    try {
      await actions.deleteItem({ orderId, itemId: item.id });
      onDeleteSelf();
    } catch (e) {
      console.error("[folder-node] deleteSelf:", e);
      setDeletingSelf(false);
      setConfirmingDeleteSelf(false);
    }
  }

  const indent = depth * 16;

  return (
    <div>
      {/* ── Folder header row ── */}
      <div
        className="flex items-center gap-1 py-[3px] pr-1 rounded group hover:bg-muted/50 text-sm"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <ChevronIcon open={expanded} />
          <FolderSvg open={expanded} />
          <span className="truncate font-medium">{item.name}</span>
          {typeof item.childCount === "number" && item.childCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({item.childCount})
            </span>
          )}
        </button>

        {!archived && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Upload */}
            <label
              title="Dodaj pliki"
              className="cursor-pointer p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Icon s={13} sw={1.7}>
                <path d="M12 16V4M6 10l6-6 6 6M4 21h16" />
              </Icon>
              <input
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {/* New folder */}
            <button
              type="button"
              title="Nowy folder"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => {
                setShowNewFolder((v) => !v);
                if (!expanded) {
                  setExpanded(true);
                  if (contents === null) void loadContents();
                }
                setTimeout(() => newFolderInputRef.current?.focus(), 50);
              }}
            >
              <Icon s={13} sw={1.7}>
                <path d="M4 4h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                <path d="M12 10v4M10 12h4" />
              </Icon>
            </button>

            {/* Delete self */}
            {confirmingDeleteSelf ? (
              <>
                <button
                  type="button"
                  className="text-xs px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground"
                  onClick={() => void handleDeleteSelf()}
                  disabled={deletingSelf}
                >
                  {deletingSelf ? "…" : "Usuń"}
                </button>
                <button
                  type="button"
                  className="text-xs px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground"
                  onClick={() => setConfirmingDeleteSelf(false)}
                >
                  Anuluj
                </button>
              </>
            ) : (
              <button
                type="button"
                title="Usuń folder"
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingDeleteSelf(true)}
              >
                <I.trash s={13} sw={1.6} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Expanded contents ── */}
      {expanded && (
        <div>
          {/* New folder input */}
          {showNewFolder && (
            <div
              className="flex items-center gap-1 py-1 pr-1"
              style={{ paddingLeft: `${8 + indent + 30}px` }}
            >
              <FolderSvg />
              <input
                ref={newFolderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowNewFolder(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="Nazwa folderu"
                className="flex-1 text-sm border rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => void handleCreateFolder()}
                disabled={creatingFolder || !newFolderName.trim()}
                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
              >
                {creatingFolder ? "…" : "Utwórz"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName("");
                }}
                className="text-xs px-2 py-0.5 rounded hover:bg-muted text-muted-foreground"
              >
                Anuluj
              </button>
            </div>
          )}

          {/* Loading */}
          {contentsLoading && (
            <div
              className="text-xs text-muted-foreground py-1"
              style={{ paddingLeft: `${8 + indent + 30}px` }}
            >
              Ładowanie…
            </div>
          )}

          {/* Empty */}
          {!contentsLoading &&
            contents !== null &&
            contents.length === 0 &&
            uploads.length === 0 && (
              <div
                className="text-xs text-muted-foreground py-1 italic"
                style={{ paddingLeft: `${8 + indent + 30}px` }}
              >
                Folder jest pusty
              </div>
            )}

          {/* Children */}
          {contents !== null &&
            contents.map((child) =>
              child.isFolder ? (
                <FolderNode
                  key={child.id}
                  orderId={orderId}
                  item={child}
                  depth={depth + 1}
                  archived={archived}
                  actions={actions}
                  onPreview={onPreview}
                  onDeleteSelf={() => void loadContents()}
                />
              ) : (
                <FileRow
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  archived={archived}
                  onPreview={() => onPreview(child)}
                  onDelete={() => void handleDeleteChild(child.id)}
                  confirming={confirmingDeleteId === child.id}
                  onConfirmStart={() => setConfirmingDeleteId(child.id)}
                  onConfirmCancel={() => setConfirmingDeleteId(null)}
                  deleting={deletingId === child.id}
                />
              ),
            )}

          {/* Upload progress */}
          {uploads.length > 0 && (
            <div style={{ paddingLeft: `${8 + indent + 30}px` }}>
              {uploads.map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="text-muted-foreground truncate">{u.name}</span>
                  <span
                    className={
                      u.error ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    {u.error
                      ? u.error
                      : u.progress === 100
                        ? "Wysłano ✓"
                        : "Wysyłanie…"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QuoteFileBrowser ─────────────────────────────────────────────────────────

export function OrderFileBrowser({
  order,
  archived,
}: {
  order: OrderShape;
  archived?: boolean;
}) {
  const [rootItems, setRootItems] = useState<DriveItem[] | null>(null);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootConfirmingDeleteId, setRootConfirmingDeleteId] = useState<
    string | null
  >(null);
  const [rootDeletingId, setRootDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const listContents = useAction(api.sharepoint.listOrderFolderContents);
  const uploadSession = useAction(api.sharepoint.createOrderUploadSessionInFolder);
  const createFolder = useAction(api.sharepoint.createOrderSharepointSubfolder);
  const deleteItem = useAction(api.sharepoint.deleteOrderSharepointItem);
  const getFileContent = useAction(api.sharepoint.getOrderFileForPreview);

  const actions: Actions = {
    list: listContents,
    uploadSession,
    createFolder,
    deleteItem,
    getPreview: getFileContent,
  };

  const hasFolder =
    order.sharepoint?.status === "created" &&
    !!order.sharepoint.subfolderItemId;

  const loadRoot = useCallback(async () => {
    if (!hasFolder) return;
    setRootLoading(true);
    try {
      const result = await listContents({ orderId: order._id });
      setRootItems(result);
    } catch (e) {
      console.error("[file-browser] loadRoot:", e);
      setRootItems([]);
    } finally {
      setRootLoading(false);
    }
  }, [order._id, hasFolder, listContents]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  useEffect(() => {
    return () => {
      if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    };
  }, [preview?.blobUrl]);

  async function openPreview(item: DriveItem) {
    if (!canPreviewFile(item.name, item.mimeType)) return;
    if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview({ item, blobUrl: null, error: null, loading: true });
    try {
      const { base64, contentType } = await getFileContent({
        orderId: order._id,
        fileId: item.id,
      });
      const blob = b64ToBlob(base64, contentType);
      setPreview({
        item,
        blobUrl: URL.createObjectURL(blob),
        error: null,
        loading: false,
      });
    } catch (e) {
      setPreview({
        item,
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

  async function handleDeleteRootFile(itemId: string) {
    setRootDeletingId(itemId);
    try {
      await deleteItem({ orderId: order._id, itemId });
      await loadRoot();
    } catch (e) {
      console.error("[file-browser] deleteRootFile:", e);
    } finally {
      setRootDeletingId(null);
      setRootConfirmingDeleteId(null);
    }
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
              użyj przycisku „Ponów" w sekcji SharePoint.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const folders = rootItems?.filter((i) => i.isFolder) ?? [];
  const rootFiles = rootItems?.filter((i) => !i.isFolder) ?? [];
  const totalCount = rootItems?.length ?? 0;

  return (
    <section className="quote-detail-section">
      <header className="quote-detail-section-head">
        <div className="quote-detail-section-title">
          <span className="quote-detail-section-icon">
            <I.paperclip s={14} />
          </span>
          <span>Pliki</span>
          {totalCount > 0 && (
            <span className="quote-files-count">{totalCount}</span>
          )}
        </div>
        <div className="quote-detail-section-action">
          <button
            type="button"
            className="quote-detail-files-refresh"
            onClick={() => void loadRoot()}
            disabled={rootLoading}
            title="Odśwież"
          >
            <I.refresh s={14} />
          </button>
        </div>
      </header>

      <div className="quote-detail-section-body">
        {rootLoading && rootItems === null && (
          <div className="text-sm text-muted-foreground px-2 py-2">
            Ładowanie…
          </div>
        )}

        {!rootLoading && rootItems !== null && rootItems.length === 0 && (
          <div className="text-sm text-muted-foreground px-2 py-2">
            Brak plików i folderów
          </div>
        )}

        {rootItems !== null && rootItems.length > 0 && (
          <div className="py-1">
            {/* Root-level files (sprzed struktury) */}
            {rootFiles.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                depth={0}
                archived={archived}
                onPreview={() => void openPreview(item)}
                onDelete={() => void handleDeleteRootFile(item.id)}
                confirming={rootConfirmingDeleteId === item.id}
                onConfirmStart={() => setRootConfirmingDeleteId(item.id)}
                onConfirmCancel={() => setRootConfirmingDeleteId(null)}
                deleting={rootDeletingId === item.id}
              />
            ))}

            {/* Folder tree */}
            {folders.map((item) => (
              <FolderNode
                key={item.id}
                orderId={order._id}
                item={item}
                depth={0}
                archived={archived}
                actions={actions}
                onPreview={openPreview}
                onDeleteSelf={() => void loadRoot()}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview drawer */}
      {preview && (
        <>
          <div className="pdf-drawer-overlay" onClick={closePreview} />
          <div className="pdf-drawer">
            <div className="pdf-drawer-header">
              <span className="pdf-drawer-filename">{preview.item.name}</span>
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
              {preview.blobUrl &&
                (isPdf(preview.item.name) ||
                  preview.item.mimeType === "application/pdf") && (
                  <iframe
                    src={preview.blobUrl}
                    className="pdf-drawer-iframe"
                    title={preview.item.name}
                  />
                )}
              {preview.blobUrl &&
                (isImage(preview.item.name) ||
                  preview.item.mimeType.startsWith("image/")) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.blobUrl}
                    alt={preview.item.name}
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
