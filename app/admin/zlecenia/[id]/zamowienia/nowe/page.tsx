"use client";

import { useState, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "@/app/admin/_lib/icons";
import { RibbonBtn, RibbonGroup } from "@/app/admin/_components/ribbon";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { Search, X, Package, Building2, Calendar, FileText } from "lucide-react";

export default function NoweZamowieniePage({ params }: { params: Promise<{ id: Id<"orders"> }> }) {
  const router = useRouter();
  const { id: orderId } = use(params);

  const createSubOrder = useMutation(api.subOrders.create);
  const suppliers = useQuery(api.suppliers.list, {}) ?? [];
  const allOrders = useQuery(api.orders.list, {}) ?? [];

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([orderId]);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");

  const [supplierId, setSupplierId] = useState<string>("");
  const [extOrderNum, setExtOrderNum] = useState<string>("");
  const [pickupDate, setPickupDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [creating, setCreating] = useState(false);

  // Przefiltrowane zlecenia
  const filteredOrders = useMemo(() => {
    if (!orderSearchTerm.trim()) return allOrders;
    const q = orderSearchTerm.toLowerCase();
    return allOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        (o.clientEmail && o.clientEmail.toLowerCase().includes(q))
    );
  }, [allOrders, orderSearchTerm]);

  // Przefiltrowani dostawcy
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm.trim()) return suppliers;
    const q = supplierSearchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nip && s.nip.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearchTerm]);

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((oId) => oId !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error("Wybierz przynajmniej jedno zlecenie główne");
      return;
    }

    setCreating(true);
    try {
      const newSubOrderId = await createSubOrder({
        orderId: selectedOrderIds[0] as Id<"orders">,
        orderIds: selectedOrderIds as Id<"orders">[],
        supplierId: supplierId === "" ? undefined : (supplierId as Id<"suppliers">),
        externalOrderNumber: extOrderNum.trim() || undefined,
        pickupDate: pickupDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Utworzono nowe zamówienie dla ${selectedOrderIds.length} zleceń!`);
      router.push(`/admin/zlecenia/${selectedOrderIds[0]}/zamowienia/${newSubOrderId}`);
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas tworzenia zamówienia");
      setCreating(false);
    }
  };

  return (
    <div className="fluent-layout" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", background: "#0d1117", color: "#c9d1d9" }}>
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn
            icon={<I.arrowLeft s={22} />}
            label="Wróć"
            onClick={() => router.push(`/admin/zlecenia/${orderId}`)}
          />
        </RibbonGroup>
        <RibbonGroup label="Akcje">
          <RibbonBtn
            icon={<I.check s={22} />}
            label="Utwórz zamówienie"
            onClick={handleCreate}
            disabled={creating || selectedOrderIds.length === 0}
          />
        </RibbonGroup>
      </div>

      <div className="fluent-content p-6" style={{ maxWidth: 800, width: "100%", margin: "0 auto", flex: "1 0 auto" }}>
        <div style={{ background: "#161b22", padding: 28, borderRadius: 12, border: "1px solid #30363d", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Package size={26} color="#58a6ff" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f0f6fc", margin: 0 }}>Nowe zamówienie podwykonawcze</h2>
          </div>
          <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 24 }}>
            Tworzysz zamówienie podwykonawcze. Możesz połączyć to zamówienie z <b>jednym lub wieloma zleceniami naraz</b>.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* SEKCJA 1: WYBÓR ZLECEŃ */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>
                  1. Wybierz zlecenia główne ({selectedOrderIds.length} wybranych) *
                </label>
                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds([])}
                    style={{ background: "none", border: "none", color: "#f85149", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                  >
                    Wyczyść zaznaczenie
                  </button>
                )}
              </div>

              {/* Tagi wybranych zleceń */}
              {selectedOrderIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, background: "#0d1117", padding: 10, borderRadius: 8, border: "1px solid #30363d" }}>
                  {selectedOrderIds.map((id) => {
                    const ord = allOrders.find((o) => o._id === id);
                    return (
                      <span
                        key={id}
                        style={{
                          background: "rgba(88,166,255,0.15)",
                          border: "1px solid rgba(88,166,255,0.4)",
                          color: "#58a6ff",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {ord ? `${ord.orderNumber} (${ord.clientName})` : id}
                        <X
                          size={13}
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleOrderSelection(id)}
                        />
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Wyszukiwarka zleceń */}
              <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 10px", marginBottom: 8 }}>
                <Search size={16} color="#8b949e" style={{ marginRight: 8 }} />
                <input
                  type="text"
                  placeholder="Szukaj zlecenia po numerze lub nazwie klienta..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  style={{ background: "transparent", border: "none", color: "#f0f6fc", fontSize: 13, padding: "9px 0", width: "100%", outline: "none" }}
                />
                {orderSearchTerm && (
                  <X size={14} color="#8b949e" style={{ cursor: "pointer" }} onClick={() => setOrderSearchTerm("")} />
                )}
              </div>

              {/* Lista zleceń */}
              <div style={{ maxHeight: 180, overflowY: "auto", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((ord) => {
                    const isChecked = selectedOrderIds.includes(ord._id);
                    return (
                      <label
                        key={ord._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: isChecked ? "rgba(88,166,255,0.1)" : "transparent",
                          border: isChecked ? "1px solid rgba(88,166,255,0.3)" : "1px solid transparent",
                          cursor: "pointer",
                          fontSize: 13,
                          color: "#c9d1d9",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOrderSelection(ord._id)}
                            style={{ accentColor: "#1f6feb", width: 16, height: 16, cursor: "pointer" }}
                          />
                          <div>
                            <span style={{ fontWeight: 700, color: "#f0f6fc", marginRight: 8 }}>{ord.orderNumber}</span>
                            <span style={{ color: "#8b949e" }}>• {ord.clientName}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ padding: 12, textAlign: "center", color: "#8b949e", fontSize: 12 }}>
                    Brak zleceń pasujących do zapytania &quot;{orderSearchTerm}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* SEKCJA 2: WYBÓR DOSTAWCY / PODWYKONAWCY */}
            <div>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc", display: "block", marginBottom: 8 }}>
                2. Wybierz Podwykonawcę / Dostawcę
              </label>

              {/* Jeśli wybrano dostawcę */}
              {supplierId ? (
                <div style={{ background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.4)", padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Building2 size={22} color="#60a5fa" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>
                        {suppliers.find((s) => s._id === supplierId)?.name || "Wybrany podwykonawca"}
                      </div>
                      <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 2 }}>
                        {suppliers.find((s) => s._id === supplierId)?.nip ? `NIP: ${suppliers.find((s) => s._id === supplierId)?.nip}` : ''}
                        {suppliers.find((s) => s._id === supplierId)?.category ? ` • Kategoria: ${suppliers.find((s) => s._id === supplierId)?.category}` : ''}
                        {suppliers.find((s) => s._id === supplierId)?.email ? ` • ${suppliers.find((s) => s._id === supplierId)?.email}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSupplierId(""); setSupplierSearchTerm(""); }}
                    style={{ background: "#21262d", border: "1px solid #30363d", color: "#f85149", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <X size={14} /> Zmień / Wyczyść
                  </button>
                </div>
              ) : (
                <div>
                  {/* Input z natywną listą podpowiedzi (HTML5 Datalist) */}
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 12px" }}>
                      <Search size={16} color="#60a5fa" style={{ marginRight: 8, flexShrink: 0 }} />
                      <input
                        type="text"
                        list="suppliers-page-datalist"
                        placeholder="Wpisz lub wybierz podwykonawcę (np. Lakiernia, NIP, nazwa)..."
                        value={supplierSearchTerm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSupplierSearchTerm(val);
                          const matched = suppliers.find(
                            (s) => s.name.toLowerCase() === val.toLowerCase() || (s.nip && s.nip === val)
                          );
                          if (matched) {
                            setSupplierId(matched._id);
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: "#f0f6fc", fontSize: 13, padding: "10px 0", width: "100%", outline: "none" }}
                      />
                      {supplierSearchTerm && (
                        <X size={14} color="#8b949e" style={{ cursor: "pointer" }} onClick={() => setSupplierSearchTerm("")} />
                      )}
                    </div>

                    {/* NATYWNY HTML5 DATALIST PREZENTUJĄCY PODPOWIEDZI BROWSERA */}
                    <datalist id="suppliers-page-datalist">
                      <option value="Realizacja wewnętrzna (Brak podwykonawcy)" />
                      {suppliers.map((s) => (
                        <option key={s._id} value={s.name}>
                          {s.nip ? `NIP: ${s.nip}` : ''} {s.category ? `[${s.category}]` : ''} {s.email ? `(${s.email})` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* INTERAKTYWNA LISTA KART DOSTAWCÓW DO KLIKNIĘCIA */}
                  <div style={{ maxHeight: 170, overflowY: "auto", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div
                      onClick={() => { setSupplierId(""); setSupplierSearchTerm(""); }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: supplierId === "" ? "rgba(96,165,250,0.1)" : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "#8b949e",
                        fontWeight: 600,
                      }}
                    >
                      🏠 Realizacja wewnętrzna (Brak podwykonawcy)
                    </div>

                    {filteredSuppliers.map((sup) => (
                      <div
                        key={sup._id}
                        onClick={() => {
                          setSupplierId(sup._id);
                          setSupplierSearchTerm(sup.name);
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: supplierId === sup._id ? "rgba(96,165,250,0.15)" : "#161b22",
                          border: "1px solid #30363d",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 13,
                          transition: "all 0.12s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Building2 size={16} color="#60a5fa" />
                          <div>
                            <span style={{ fontWeight: 700, color: "#f0f6fc", marginRight: 8 }}>{sup.name}</span>
                            {sup.nip && <span style={{ fontSize: 12, color: "#8b949e" }}>NIP: {sup.nip}</span>}
                          </div>
                        </div>
                        {sup.category && (
                          <span style={{ fontSize: 11, background: "#21262d", padding: "2px 8px", borderRadius: 4, color: "#93c5fd" }}>
                            {sup.category}
                          </span>
                        )}
                      </div>
                    ))}

                    {filteredSuppliers.length === 0 && supplierSearchTerm && (
                      <div style={{ padding: 12, textAlign: "center", color: "#8b949e", fontSize: 12 }}>
                        Nie znaleziono podwykonawcy dla &quot;{supplierSearchTerm}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SEKCJA 3: SZCZEGÓŁY ZAMÓWIENIA */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Nr zamówienia u dostawcy (opcjonalnie)
                </label>
                <input
                  type="text"
                  placeholder="np. DOST/2026/999"
                  value={extOrderNum}
                  onChange={(e) => setExtOrderNum(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0d1117",
                    border: "1px solid #30363d",
                    color: "#f0f6fc",
                    padding: "9px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Planowana data odbioru
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0d1117",
                    border: "1px solid #30363d",
                    color: "#f0f6fc",
                    padding: "9px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    outline: "none",
                    colorScheme: "dark",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6, fontWeight: 600 }}>
                Uwagi i instrukcje dla podwykonawcy
              </label>
              <textarea
                rows={3}
                placeholder="Wytyczne dotyczące lakierowania, spawania, cięcia..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  color: "#f0f6fc",
                  padding: "9px 12px",
                  borderRadius: 6,
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            {/* PODSUMOWANIE I PRZYCISK UTWÓRZ */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid #30363d" }}>
              <div style={{ fontSize: 13, color: "#8b949e" }}>
                Zaznaczono zleceń: <b style={{ color: "#58a6ff" }}>{selectedOrderIds.length}</b>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || selectedOrderIds.length === 0}
                style={{
                  background: selectedOrderIds.length > 0 ? "#238636" : "#21262d",
                  color: selectedOrderIds.length > 0 ? "#fff" : "#8b949e",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 8,
                  cursor: selectedOrderIds.length > 0 ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: selectedOrderIds.length > 0 ? "0 2px 8px rgba(35,134,54,0.3)" : "none",
                }}
              >
                {creating ? "Tworzenie..." : `Utwórz zamówienie podwykonawcze (${selectedOrderIds.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
