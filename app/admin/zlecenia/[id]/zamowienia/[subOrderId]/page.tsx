"use client";

import { useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "@/app/admin/_lib/icons";
import { RibbonBtn, RibbonGroup } from "@/app/admin/_components/ribbon";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { Building2, Home, Package, PenTool, Search, Plus, X, Tag } from "lucide-react";

type SubOrderStatus = "utworzono" | "do_zamowienia" | "zamowiono" | "odbior" | "zamkniete";

const STATUS_CONFIG: Record<SubOrderStatus, { label: string; color: string; bg: string }> = {
  utworzono:     { label: "Utworzono",     color: "#8b949e", bg: "rgba(139,148,158,0.15)" },
  do_zamowienia: { label: "Do zamówienia", color: "#f0883e", bg: "rgba(240,136,62,0.15)"  },
  zamowiono:     { label: "Zamówiono",     color: "#58a6ff", bg: "rgba(88,166,255,0.15)"  },
  odbior:        { label: "Odbiór",        color: "#d29922", bg: "rgba(210,153,34,0.15)"  },
  zamkniete:     { label: "Zamknięte",     color: "#3fb950", bg: "rgba(63,185,80,0.15)"   },
};

const STATUS_ORDER: SubOrderStatus[] = ["utworzono", "do_zamowienia", "zamowiono", "odbior", "zamkniete"];

function SubOrderStatusPipeline({ status, onChange }: { status: SubOrderStatus; onChange: (s: SubOrderStatus) => void }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div className="quote-detail-pipeline" aria-label="Status pipeline">
      {STATUS_ORDER.map((s, idx) => {
        const cfg = STATUS_CONFIG[s];
        const done = idx < currentIdx;
        const current = idx === currentIdx;
        const clickable = !current;
        return (
          <div
            key={s}
            className={`quote-detail-pipeline-step${current ? " is-current" : ""}${done ? " is-done" : ""}`}
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onChange(s) : undefined}
              className={`quote-detail-pipeline-marker${clickable ? " is-clickable" : ""}`}
              style={current ? { background: cfg.color, borderColor: cfg.color } : done ? { borderColor: cfg.color } : undefined}
              title={clickable ? `Ustaw status: ${cfg.label}` : undefined}
            >
              {done ? <I.check s={11} sw={2.4} /> : <span className="quote-detail-pipeline-dot" />}
            </button>
            <div className="quote-detail-pipeline-label" style={current ? { color: cfg.color } : undefined}>
              {cfg.label}
            </div>
            {STATUS_ORDER.length > 0 && idx < STATUS_ORDER.length - 1 && (
              <div className={`quote-detail-pipeline-bar${idx < currentIdx ? " is-done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ownerInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ZamowienieGanttPage({ params }: { params: Promise<{ id: Id<"orders">; subOrderId: Id<"subOrders"> }> }) {
  const router = useRouter();
  const { id: orderId, subOrderId } = use(params);

  const data = useQuery(api.subOrders.get, { subOrderId });
  const order = useQuery(api.orders.get, { id: orderId });
  const client = useQuery(api.clients.get, order?.clientId ? { id: order.clientId } : "skip");
  const owners = useQuery(api.users.getByIds, order?.ownerId ? { userIds: [order.ownerId] } : "skip") as any[] | undefined;
  const allProducts = useQuery(api.products.list, {}) ?? []; 

  const updateStatus = useMutation(api.subOrders.updateStatus);
  const addItem = useMutation(api.subOrders.addItem);
  const removeItem = useMutation(api.subOrders.removeItem);
  const updateExternalOrderNumber = useMutation(api.subOrders.updateExternalOrderNumber);

  const [addingType, setAddingType] = useState<"product" | "custom">("product");
  const [addingProduct, setAddingProduct] = useState<Id<"products"> | "">("");
  const [addingCustomName, setAddingCustomName] = useState("");
  const [addingCustomValue, setAddingCustomValue] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [showOrderNumModal, setShowOrderNumModal] = useState(false);
  const [externalNumberInput, setExternalNumberInput] = useState("");

  const selectedProduct = useMemo(() => {
    if (!addingProduct) return null;
    return allProducts.find(p => p._id === addingProduct) || null;
  }, [allProducts, addingProduct]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts.slice(0, 50);
    const q = productSearch.toLowerCase();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [allProducts, productSearch]);

  if (!data || !order) {
    return <div style={{ color: "#8b949e", padding: 24 }}>Ładowanie szczegółów...</div>;
  }

  const { items, supplier, ...subOrder } = data;

  const handleAdd = async () => {
    if (addingType === "product" && !addingProduct) {
      toast.error("Wybierz produkt z bazy");
      return;
    }
    if (addingType === "custom" && !addingCustomName.trim()) {
      toast.error("Podaj nazwę dla luźnej pozycji");
      return;
    }
    
    try {
      await addItem({
        subOrderId,
        productId: addingType === "product" ? (addingProduct as Id<"products">) : undefined,
        customName: addingType === "custom" ? addingCustomName : undefined,
        customValueNetto: addingType === "custom" ? (Number(addingCustomValue.replace(",", ".")) || 0) : undefined,
      });
      toast.success("Dodano pozycję");
      setAddingProduct("");
      setProductSearch("");
      setAddingCustomName("");
      setAddingCustomValue("");
    } catch (e: any) {
      toast.error(e.message || "Błąd dodawania");
    }
  };

  const handleStatusChange = (s: SubOrderStatus) => {
    if (s === "zamowiono" && subOrder.status !== "zamowiono") {
      setExternalNumberInput(subOrder.externalOrderNumber || "");
      setShowOrderNumModal(true);
    } else {
      updateStatus({ subOrderId, status: s });
    }
  };

  const handleSaveExternalNumber = async () => {
    if (!externalNumberInput.trim()) {
      toast.error("Wpisz zewnętrzny numer zamówienia (od dostawcy)");
      return;
    }
    try {
      await updateExternalOrderNumber({ subOrderId, externalOrderNumber: externalNumberInput });
      await updateStatus({ subOrderId, status: "zamowiono" });
      setShowOrderNumModal(false);
      toast.success("Status zaktualizowany");
    } catch {
      toast.error("Wystąpił błąd");
    }
  };

  const handleRemove = async (itemId: Id<"subOrderItems">) => {
    if (!confirm("Na pewno usunąć tę pozycję?")) return;
    try {
      await removeItem({ itemId });
      toast.success("Usunięto pozycję");
    } catch (e: any) {
      toast.error("Błąd usuwania");
    }
  };

  const ownerName = order.ownerId ? (owners?.[0]?.name?.trim() || owners?.[0]?.email?.trim() || "…") : "Nieprzypisany";
  const clientType = client?.type;
  const typeLabel = clientType === "business" ? "Firma" : clientType === "individual" ? "Osoba prywatna" : null;
  const address = [client?.street, client?.postalCity].filter(Boolean).join(", ");
  const nip = client?.nip;
  const phone = order.clientPhone || client?.phoneNormalized;
  const email = order.clientEmail || client?.email;
  const customLabel = order.customLabel;
  const investmentLabel = order.investment?.address || "Brak lokalizacji inwestycji";

  return (
    <div className="fluent-layout">
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn icon={<I.arrowLeft s={22} />} label="Wróć" onClick={() => router.push(`/admin/zlecenia/${orderId}`)} />
        </RibbonGroup>
      </div>

      <div className="fluent-content">
        <div className="quote-detail-header" style={{ padding: "16px 20px", gap: 14, background: "#161b22", borderBottom: "1px solid #30363d" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div className="quote-detail-header-row" style={{ gap: 12, alignItems: "center" }}>
              <div className="quote-detail-header-main" style={{ gap: 4 }}>
                <div className="quote-detail-hero" style={{ alignItems: "center", gap: 8 }}>
                  <div className="quote-detail-id-pill" style={{ padding: "4px 8px" }}>
                    <span className="quote-detail-id-label" style={{ fontSize: 9 }}>Numer zlecenia</span>
                    <span className="quote-detail-id-value" style={{ fontSize: 13, fontWeight: 700 }}>{order.orderNumber}</span>
                  </div>
                  
                  <div className="quote-detail-client-strip" style={{ padding: "4px 8px", cursor: "default" }}>
                    <span className="quote-detail-client-avatar" aria-hidden style={{ width: 26, height: 26, fontSize: 11 }}>{ownerInitials(order.clientName)}</span>
                    <span className="quote-detail-client-info" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span className="quote-detail-client-name" style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {order.clientName}
                        {typeLabel && (
                          <span style={{ fontSize: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "0 5px", color: "var(--text-muted)", fontWeight: 500 }}>
                            {typeLabel}
                          </span>
                        )}
                      </span>
                      {(nip || phone || address || email) && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap", fontWeight: 400 }}>
                          {nip && <span>NIP: {nip}</span>}
                          {address && <span>📍 {address}</span>}
                          {phone && <span>📞 {phone}</span>}
                          {email && <span>✉️ {email}</span>}
                        </span>
                      )}
                    </span>
                  </div>

                  {order.investment?.address && (
                    <div className="quote-detail-investment-trigger" style={{ padding: "4px 8px", fontSize: 12, cursor: "default" }}>
                      <span className="quote-detail-investment-trigger-icon"><I.pin s={13} sw={2} /></span>
                      <span className="quote-detail-investment-trigger-value">{investmentLabel}</span>
                      {order.investment.notes && (
                        <span style={{ fontSize: "10px", fontWeight: 600, background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.4)", padding: "1px 5px", borderRadius: "4px", marginLeft: "4px", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          📝 z notatką
                        </span>
                      )}
                    </div>
                  )}

                  {customLabel && (
                    <div style={{ display: "inline-flex", alignItems: "center" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "bold", textTransform: "uppercase", color: "var(--accent-primary)", background: "var(--accent-soft)", border: "1px solid var(--accent-line)", padding: "2px 8px", borderRadius: "5px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <strong>{customLabel}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="quote-detail-header-meta" style={{ gap: 12, alignItems: "center" }}>
                <div className="quote-detail-meta-item">
                  <div className="quote-detail-meta-label" style={{ fontSize: 10 }}>Wartość netto</div>
                  <div className="quote-detail-meta-value">
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "1px 4px" }}>
                      <span className="quote-detail-meta-num" style={{ fontSize: 14, fontWeight: 700 }}>{formatPLN(order.valueNetto || 0)}</span>
                      <span className="quote-detail-meta-unit" style={{ fontSize: 11 }}>PLN</span>
                    </div>
                  </div>
                </div>
                <div className="quote-detail-meta-divider" />
                <div className="quote-detail-meta-item">
                  <div className="quote-detail-meta-label" style={{ fontSize: 10 }}>Opiekun</div>
                  <div className="quote-detail-meta-value quote-detail-meta-owner" style={{ padding: "2px 4px", cursor: "default" }}>
                    <span className="kanban-card-owner-avatar" style={{ width: 22, height: 22, fontSize: 9 }}>{ownerInitials(ownerName)}</span>
                    <span className="quote-detail-meta-num" style={{ fontSize: 13 }}>{ownerName}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Metadane subOrder (zamówienia podwykonawczego) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#8b949e" }}>Numer zamówienia wewnętrznego:</div>
              <div style={{ fontSize: 16, color: "#c9d1d9", fontWeight: 700 }}>{subOrder.orderNumber}</div>
              <div style={{ color: "#8b949e", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                {subOrder.supplierId
                  ? <><Building2 size={13} /><span style={{ color: "#58a6ff" }}>{supplier?.name ?? "Podwykonawca"}</span></>
                  : <><Home size={13} /> Realizacja wewnętrzna</>
                }
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #30363d" }}>
            <SubOrderStatusPipeline
              status={subOrder.status as SubOrderStatus}
              onChange={(s) => updateStatus({ subOrderId, status: s })}
            />
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Formularz dodawania pozycjonalnego */}
          <div style={{
            background: "#161b22",
            padding: 18,
            borderRadius: 12,
            border: "1px solid #30363d",
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c9d1d9" }}>Dodaj pozycję do zamówienia:</span>
              </div>
              
              {/* Przełącznik Typu - Segmented Toggle Switch */}
              <div style={{ display: "inline-flex", gap: 4, background: "#0d1117", padding: 4, borderRadius: 8, border: "1px solid #30363d" }}>
                <button
                  type="button"
                  onClick={() => { setAddingType("product"); setAddingProduct(""); setProductSearch(""); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: addingType === "product" ? "#1f6feb" : "transparent",
                    color: addingType === "product" ? "#ffffff" : "#8b949e",
                    boxShadow: addingType === "product" ? "0 2px 6px rgba(31,111,235,0.4)" : "none",
                  }}
                >
                  <Package size={14} />
                  Produkt z bazy
                </button>

                <button
                  type="button"
                  onClick={() => { setAddingType("custom"); setAddingProduct(""); setProductSearch(""); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: addingType === "custom" ? "#1f6feb" : "transparent",
                    color: addingType === "custom" ? "#ffffff" : "#8b949e",
                    boxShadow: addingType === "custom" ? "0 2px 6px rgba(31,111,235,0.4)" : "none",
                  }}
                >
                  <PenTool size={14} />
                  Luźna pozycja
                </button>
              </div>
            </div>

            {/* Wiersz wprowadzania danych */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              {addingType === "product" ? (
                <div style={{ position: "relative", flex: 1, minWidth: 280 }}>
                  {selectedProduct ? (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#0d1117",
                      border: "1px solid #388bfd",
                      padding: "8px 12px",
                      borderRadius: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ background: "rgba(88,166,255,0.15)", padding: 6, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Package size={16} color="#58a6ff" />
                        </div>
                        <div>
                          <div style={{ color: "#f0f6fc", fontSize: 13, fontWeight: 600 }}>
                            {selectedProduct.name}
                          </div>
                          <div style={{ color: "#8b949e", fontSize: 11, display: "flex", gap: 10, marginTop: 2 }}>
                            {selectedProduct.code && <span>Kod: {selectedProduct.code}</span>}
                            {selectedProduct.priceNetto !== undefined && (
                              <span style={{ color: "#3fb950", fontWeight: 600 }}>{formatPLN(selectedProduct.priceNetto)} PLN</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddingProduct("")}
                        style={{ background: "#21262d", border: "none", color: "#8b949e", cursor: "pointer", padding: "4px 8px", borderRadius: 4, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                        title="Zmień produkt"
                      >
                        <X size={14} /> Zmień
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        background: "#0d1117",
                        border: "1px solid #30363d",
                        borderRadius: 8,
                        padding: "0 12px",
                      }}>
                        <Search size={15} color="#8b949e" style={{ marginRight: 8, flexShrink: 0 }} />
                        <input
                          type="text"
                          placeholder="Szukaj produktu z bazy po nazwie, SKU lub kategorii..."
                          value={productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          style={{
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#c9d1d9",
                            fontSize: 13,
                            padding: "9px 0",
                            width: "100%"
                          }}
                        />
                        {productSearch && (
                          <button
                            type="button"
                            onClick={() => setProductSearch("")}
                            style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: 2 }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {isDropdownOpen && (
                        <>
                          <div
                            style={{ position: "fixed", inset: 0, zIndex: 99 }}
                            onClick={() => setIsDropdownOpen(false)}
                          />
                          <div style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            right: 0,
                            maxHeight: 280,
                            overflowY: "auto",
                            background: "#161b22",
                            border: "1px solid #30363d",
                            borderRadius: 8,
                            boxShadow: "0 12px 28px rgba(0,0,0,0.6)",
                            zIndex: 100,
                            padding: 6
                          }}>
                            {filteredProducts.length > 0 ? (
                              filteredProducts.map((p) => (
                                <div
                                  key={p._id}
                                  onClick={() => {
                                    setAddingProduct(p._id);
                                    setIsDropdownOpen(false);
                                    setProductSearch("");
                                  }}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: 2,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#21262d")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <div>
                                    <div style={{ color: "#c9d1d9", fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                                    <div style={{ color: "#8b949e", fontSize: 11, display: "flex", gap: 8, marginTop: 2 }}>
                                      {p.code && <span style={{ background: "#0d1117", padding: "1px 6px", borderRadius: 4, border: "1px solid #30363d" }}>SKU: {p.code}</span>}
                                      {p.category && <span>{p.category}</span>}
                                    </div>
                                  </div>
                                  {p.priceNetto !== undefined && (
                                    <div style={{ color: "#3fb950", fontSize: 12, fontWeight: 600 }}>
                                      {formatPLN(p.priceNetto)} PLN
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div style={{ padding: "16px", color: "#8b949e", fontSize: 13, textAlign: "center" }}>
                                Brak produktów pasujących do zapytania "{productSearch}"
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 2, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 12px" }}>
                      <Tag size={14} color="#8b949e" style={{ marginRight: 8, flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Nazwa pozycji (np. Montaż dodatkowy)..."
                        value={addingCustomName}
                        onChange={e => setAddingCustomName(e.target.value)}
                        style={{ background: "transparent", border: "none", outline: "none", color: "#c9d1d9", fontSize: 13, padding: "9px 0", width: "100%" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 12px" }}>
                      <span style={{ fontSize: 12, color: "#8b949e", marginRight: 6, fontWeight: 600 }}>PLN</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Wartość netto"
                        value={addingCustomValue}
                        onChange={e => setAddingCustomValue(e.target.value)}
                        style={{ background: "transparent", border: "none", outline: "none", color: "#c9d1d9", fontSize: 13, padding: "9px 0", width: "100%" }}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={handleAdd}
                style={{
                  background: "#238636",
                  color: "#fff",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(35,134,54,0.3)",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2ea043")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#238636")}
              >
                <Plus size={16} /> Dodaj pozycję
              </button>
            </div>
          </div>

          {/* LISTA POZYCJI */}
          {items.length > 0 ? (
            <div style={{ background: "#0d1117", borderRadius: 8, border: "1px solid #30363d", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: "#8b949e", fontSize: 12, fontWeight: 600 }}>Lp.</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: "#8b949e", fontSize: 12, fontWeight: 600 }}>Nazwa</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", color: "#8b949e", fontSize: 12, fontWeight: 600 }}>Cena netto</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item._id} style={{ borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "12px 16px", color: "#8b949e", fontSize: 13, width: "5%" }}>{idx + 1}</td>
                      <td style={{ padding: "12px 16px", color: "#c9d1d9", fontSize: 13, fontWeight: 500, width: "65%" }}>{item.name}</td>
                      <td style={{ padding: "12px 16px", color: "#c9d1d9", fontSize: 13, textAlign: "right", width: "20%" }}>{formatPLN(item.priceNetto || 0)} PLN</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", width: "10%" }}>
                        <button onClick={() => handleRemove(item._id)} style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", padding: "4px 8px", fontSize: 12, borderRadius: 4 }}>Usuń</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#8b949e", padding: 40, border: "1px dashed #30363d", borderRadius: 8 }}>Brak pozycji w tym zamówieniu. Dodaj pierwszą pozycję.</div>
          )}

          {/* Modal na numer zamówienia zewnętrznego */}
          {showOrderNumModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
              <div style={{ background: "#161b22", padding: 24, borderRadius: 8, border: "1px solid #30363d", width: 400 }}>
                <h3 style={{ color: "#c9d1d9", marginTop: 0 }}>Numer u dostawcy</h3>
                <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 20 }}>
                  Aby przejść w status <strong>Zamówiono</strong> podaj numer zamówienia, który otrzymałeś od podwykonawcy / dostawcy.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#8b949e" }}>Numer zewnętrzny</label>
                  <input type="text" placeholder="Np. ZAM/123/2023" value={externalNumberInput} onChange={e => setExternalNumberInput(e.target.value)} style={{ background: "#0d1117", color: "#c9d1d9", border: "1px solid #30363d", padding: "8px", borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
                  <button onClick={() => setShowOrderNumModal(false)} style={{ background: "transparent", color: "#c9d1d9", border: "1px solid #30363d", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>Anuluj</button>
                  <button onClick={handleSaveExternalNumber} style={{ background: "#58a6ff", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>Zapisz i zmień status</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
