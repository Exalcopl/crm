"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "@/app/admin/_lib/icons";
import { RibbonBtn, RibbonGroup } from "@/app/admin/_components/ribbon";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function NoweZamowieniePage({ params }: { params: Promise<{ id: Id<"orders"> }> }) {
  const router = useRouter();
  const { id: orderId } = use(params);
  
  const createSubOrder = useMutation(api.subOrders.create);
  const suppliers = useQuery(api.suppliers.list, {}) ?? []; // Zakładamy że istnieje zapytanie list

  const [supplierId, setSupplierId] = useState<Id<"suppliers"> | "">("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newSubOrderId = await createSubOrder({
        orderId,
        supplierId: supplierId === "" ? undefined : (supplierId as Id<"suppliers">),
      });
      toast.success("Utworzono nowe zamówienie!");
      router.push(`/admin/zlecenia/${orderId}/zamowienia/${newSubOrderId}`);
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas tworzenia zamówienia");
      setCreating(false);
    }
  };

  return (
    <div className="fluent-layout">
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
            disabled={creating}
          />
        </RibbonGroup>
      </div>

      <div className="fluent-content p-6">
        <div style={{ maxWidth: 600, background: "#161b22", padding: 24, borderRadius: 8, border: "1px solid #30363d" }}>
          <h2 style={{ fontSize: 18, color: "#c9d1d9", marginBottom: 16 }}>Nowe zamówienie podwykonawcze</h2>
          <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 24 }}>
            Utwórz nowe puste zamówienie, a w następnym kroku dodasz do niego usługi i produkty.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#c9d1d9" }}>
              Podwykonawca / Dostawca (Opcjonalnie)
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value as any)}
              style={{
                background: "#0d1117",
                border: "1px solid #30363d",
                color: "#c9d1d9",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 14,
                outline: "none"
              }}
            >
              <option value="">Wewnętrzne (Brak podwykonawcy)</option>
              {suppliers.map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
