"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { I } from "../../../_lib/icons";

type ParsedItem = {
  lp: number;
  element: string;
  quantity: number;
  unit: string;
  priceUnit: number;
  priceTotal: number;
  description?: string;
  materialId?: string;
  matchScore?: number;
};

type ParsedSection = {
  id: string;
  name: string;
  items: ParsedItem[];
  sectionTotal: number;
};

interface RwOcrModalProps {
  orderId: Id<"orders">;
  onClose: () => void;
  onSuccess: () => void;
}

export function RwOcrModal({ orderId, onClose, onSuccess }: RwOcrModalProps) {
  const [step, setStep] = useState<"select" | "preview">("select");
  const [loading, setLoading] = useState(false);
  const [selectedFileItem, setSelectedFileItem] = useState<{ id: string; name: string } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Podgląd odczytanych sekcji
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [sourceFileName, setSourceFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const parseRwAction = useAction(api.rwOcrAction.parseRwDocument);
  const saveParsedRwMutation = useMutation(api.orderRw.saveParsedRw);

  // Pobierz pliki podłączone pod zlecenie w SharePoint
  const [spFilesLoading, setSpFilesLoading] = useState(false);
  const [spFiles, setSpFiles] = useState<Array<{ id: string; name: string; size: number }>>([]);
  const listOrderFilesAction = useAction(api.sharepoint.listOrderFolderContents);

  // Pobierz pliki z SharePoint przy montowaniu
  useState(() => {
    let active = true;
    setSpFilesLoading(true);
    listOrderFilesAction({ orderId })
      .then((res) => {
        if (active && Array.isArray(res)) {
          const filesOnly = res.filter((item: any) => item.name && !item.name.endsWith("/"));
          setSpFiles(filesOnly);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSpFilesLoading(false);
      });
    return () => { active = false; };
  });

  // Konwersja pliku lokalnego na Base64
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const res = reader.result as string;
        // Odcięcie prefixu data:application/pdf;base64,
        const base64 = res.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  // Uruchomienie odczytu OCR / Mock
  async function handleRunOcr() {
    if (!selectedFileItem && !uploadFile) {
      toast.error("Wybierz plik ze zlecenia lub wgraj nowy plik RW z komputera.");
      return;
    }

    setLoading(true);
    try {
      let fileBase64: string | undefined = undefined;
      let fileName = "";
      let mimeType = "application/pdf";
      let fileItemId: string | undefined = undefined;

      if (uploadFile) {
        fileName = uploadFile.name;
        mimeType = uploadFile.type || "application/pdf";
        fileBase64 = await fileToBase64(uploadFile);
      } else if (selectedFileItem) {
        fileName = selectedFileItem.name;
        fileItemId = selectedFileItem.id;
      }

      setSourceFileName(fileName);
      const res = await parseRwAction({
        orderId,
        fileItemId,
        fileBase64,
        fileName,
        mimeType,
      });

      if (res && res.success) {
        setSections(res.sections);
        setIsMock(!!res.isMock);
        setStatusMessage(res.message || "");
        setStep("preview");
        toast.success(res.isMock ? "Pomyślnie wygenerowano symulację odczytu RW (Mock OCR)." : "Pomyślnie odczytano plik RW przez Claude API!");
      } else {
        toast.error("Nie udało się odczytać danych z pliku RW.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Wystąpił błąd podczas parsowania pliku RW.");
    } finally {
      setLoading(false);
    }
  }

  // Zmiana ilości lub ceny w podglądzie
  function handleUpdateItem(secIdx: number, itemIdx: number, field: keyof ParsedItem, val: any) {
    setSections((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as ParsedSection[];
      const item = copy[secIdx].items[itemIdx];
      (item as any)[field] = val;

      if (field === "quantity" || field === "priceUnit") {
        item.priceTotal = parseFloat(((Number(item.quantity) || 0) * (Number(item.priceUnit) || 0)).toFixed(2));
      }

      copy[secIdx].sectionTotal = copy[secIdx].items.reduce((s, it) => s + (it.priceTotal || 0), 0);
      return copy;
    });
  }

  // Zatwierdzenie i zapis do zlecenia
  async function handleSaveToOrder() {
    setLoading(true);
    try {
      const originalSections = sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        items: sec.items.map((it) => ({
          lp: it.lp,
          element: it.element,
          quantity: it.quantity,
          unit: it.unit,
          priceUnit: it.priceUnit,
          priceTotal: it.priceTotal,
          description: it.description || "",
        })),
        sectionTotal: sec.sectionTotal,
      }));

      const productionSections = sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        isCustom: false,
        items: sec.items.map((it) => ({
          lp: it.lp,
          element: it.element,
          quantity: it.quantity,
          unit: it.unit,
          priceUnit: it.priceUnit,
          priceTotal: it.priceTotal,
          description: it.description || "",
          materialId: it.materialId,
          originalLp: it.lp,
          changeType: "unchanged",
        })),
        sectionTotal: sec.sectionTotal,
      }));

      await saveParsedRwMutation({
        orderId,
        originalSections,
        productionSections,
        sourceFileName,
        isMock,
      });

      toast.success("Dane z dokumentu RW zostały pomyślnie zapisane w zleceniu!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się zapisać rozchodu RW w zleceniu.");
    } finally {
      setLoading(false);
    }
  }

  const grandTotal = sections.reduce((sum, sec) => sum + sec.sectionTotal, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 12,
          width: step === "select" ? 560 : 920,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
          overflow: "hidden",
          transition: "width 0.2s ease-in-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0d1117",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(88, 166, 255, 0.15)",
                color: "#58a6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <I.rw s={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f6fc" }}>
                {step === "select" ? "Odczyt Dokumentu Rozchodu (RW) – AI / OCR" : "Podgląd i Weryfikacja Danych RW"}
              </div>
              <div style={{ fontSize: 12, color: "#8b949e" }}>
                {step === "select"
                  ? "Wybierz załączony plik RW lub wgraj nowy specyfikację z komputera"
                  : `Zweryfikuj odczytane pozycje z pliku ${sourceFileName}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {step === "select" ? (
            <>
              {/* Opcja A: Upload pliku z komputera */}
              <div style={{ background: "#0d1117", border: "1.5px dashed #30363d", borderRadius: 8, padding: 20, textAlign: "center" }}>
                <div style={{ color: "#58a6ff", marginBottom: 8, display: "flex", justifyContent: "center" }}>
                  <I.upload s={24} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#f0f6fc" }}>Wgraj nowy plik specyfikacji RW z komputera</div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>Obsługiwane formaty: PDF, JPG, PNG (max 10MB)</div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      setSelectedFileItem(null);
                    }
                  }}
                  style={{ marginTop: 12, display: "inline-block", fontSize: 12, color: "#c9d1d9" }}
                />
                {uploadFile && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#3fb950", fontWeight: 500 }}>
                    Wybrano plik: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#30363d" }} />
                <span style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase" }}>LUB WYBIERZ Z DOKUMENTACJI ZLECENIA</span>
                <div style={{ flex: 1, height: 1, background: "#30363d" }} />
              </div>

              {/* Opcja B: Wybór pliku z zlecenia */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", marginBottom: 8 }}>Pliki w dokumentacji zlecenia (SharePoint):</div>
                {spFilesLoading ? (
                  <div style={{ fontSize: 12, color: "#8b949e", padding: 12, textAlign: "center" }}>Ładowanie plików zlecenia…</div>
                ) : spFiles.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#8b949e", background: "#0d1117", padding: 14, borderRadius: 6, textAlign: "center" }}>
                    Brak załączonych plików w dokumentacji zlecenia. Użyj pola wgrywania powyżej.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                    {spFiles.map((file) => {
                      const isSel = selectedFileItem?.id === file.id;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => {
                            setSelectedFileItem({ id: file.id, name: file.name });
                            setUploadFile(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: isSel ? "rgba(88, 166, 255, 0.12)" : "#0d1117",
                            border: `1px solid ${isSel ? "#58a6ff" : "#21262d"}`,
                            color: "#f0f6fc",
                            fontSize: 13,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ fontWeight: isSel ? 600 : 400 }}>{file.name}</span>
                          <span style={{ fontSize: 11, color: "#8b949e" }}>{(file.size / 1024).toFixed(0)} KB</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Krok 2: Podgląd wyników OCR / Mock */
            <>
              {isMock && (
                <div
                  style={{
                    background: "rgba(210, 153, 34, 0.12)",
                    border: "1px solid #d29922",
                    borderRadius: 6,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#f2cc60",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <I.info s={18} />
                  <div>
                    <strong>Tryb Symulacji (Mock OCR Parser)</strong>: {statusMessage}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 13, color: "#8b949e", display: "flex", justifyContent: "space-between" }}>
                <span>Zweryfikuj odczytane pozycje. Wszystkie pola ilości i cen są edytowalne.</span>
                <span style={{ color: "#3fb950", fontWeight: 600 }}>Łączna wartość RW: {grandTotal.toFixed(2)} zł</span>
              </div>

              {/* Tabela sekcji */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {sections.map((sec, sIdx) => (
                  <div key={sec.id} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ background: "#161b22", padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#58a6ff", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between" }}>
                      <span>{sec.name}</span>
                      <span>Suma sekcji: {sec.sectionTotal.toFixed(2)} zł</span>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#090d11", color: "#8b949e", borderBottom: "1px solid #21262d" }}>
                          <th style={{ padding: "6px 10px", width: 40 }}>LP</th>
                          <th style={{ padding: "6px 10px" }}>Element / Materiał</th>
                          <th style={{ padding: "6px 10px", width: 90 }}>Ilość</th>
                          <th style={{ padding: "6px 10px", width: 70 }}>J.m.</th>
                          <th style={{ padding: "6px 10px", width: 100 }}>Cena jedn.</th>
                          <th style={{ padding: "6px 10px", width: 110 }}>Wartość</th>
                          <th style={{ padding: "6px 10px" }}>Opis</th>
                          <th style={{ padding: "6px 10px", width: 100 }}>Status Bazy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.items.map((it, iIdx) => (
                          <tr key={iIdx} style={{ borderBottom: "1px solid #161b22" }}>
                            <td style={{ padding: "6px 10px", color: "#8b949e" }}>{it.lp}</td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={it.element}
                                onChange={(e) => handleUpdateItem(sIdx, iIdx, "element", e.target.value)}
                                style={{ width: "100%", background: "transparent", border: "none", color: "#f0f6fc", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="number"
                                value={it.quantity}
                                onChange={(e) => handleUpdateItem(sIdx, iIdx, "quantity", parseFloat(e.target.value) || 0)}
                                style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", borderRadius: 4, color: "#f0f6fc", padding: "2px 6px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={it.unit}
                                onChange={(e) => handleUpdateItem(sIdx, iIdx, "unit", e.target.value)}
                                style={{ width: "100%", background: "transparent", border: "none", color: "#8b949e", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="number"
                                value={it.priceUnit}
                                onChange={(e) => handleUpdateItem(sIdx, iIdx, "priceUnit", parseFloat(e.target.value) || 0)}
                                style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", borderRadius: 4, color: "#f0f6fc", padding: "2px 6px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", fontWeight: 600, color: "#3fb950" }}>
                              {it.priceTotal.toFixed(2)} zł
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={it.description || ""}
                                onChange={(e) => handleUpdateItem(sIdx, iIdx, "description", e.target.value)}
                                placeholder="opcjonalnie"
                                style={{ width: "100%", background: "transparent", border: "none", color: "#8b949e", fontSize: 11 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              {it.materialId ? (
                                <span style={{ fontSize: 10, background: "rgba(63, 185, 80, 0.15)", color: "#3fb950", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>
                                  Dopasowano
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, background: "rgba(139, 148, 158, 0.15)", color: "#8b949e", padding: "2px 6px", borderRadius: 4 }}>
                                  Custom
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #30363d",
            background: "#0d1117",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost fluent-btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            Anuluj
          </button>

          {step === "select" ? (
            <button
              type="button"
              className="fluent-btn fluent-btn-primary fluent-btn-sm"
              onClick={handleRunOcr}
              disabled={loading || (!selectedFileItem && !uploadFile)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {loading ? (
                <span>Przetwarzanie OCR…</span>
              ) : (
                <>
                  <I.sparkles s={14} /> Odczytaj plik (AI / OCR)
                </>
              )}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="fluent-btn fluent-btn-ghost fluent-btn-sm"
                onClick={() => setStep("select")}
                disabled={loading}
              >
                Wybierz inny plik
              </button>
              <button
                type="button"
                className="fluent-btn fluent-btn-primary fluent-btn-sm"
                onClick={handleSaveToOrder}
                disabled={loading}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#238636", border: "none" }}
              >
                {loading ? "Zapisywanie..." : "Zatwierdź i zapisz w zleceniu"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
