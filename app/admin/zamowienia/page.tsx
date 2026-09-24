"use client";

import React from "react";
import { Package } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ZamowieniaPage() {
  return (
    <div className="fluent-layout">
      <div className="fluent-header">
        <h1 className="fluent-title">
          <Package className="mr-2 inline" size={24} /> Zamówienia
        </h1>
        <p className="fluent-subtitle">
          Wszystkie zamówienia zdefiniowane wewnątrz zleceń.
        </p>
      </div>

      <div className="fluent-content p-6">
        <div style={{ background: "#161b22", padding: 24, borderRadius: 8, border: "1px solid #30363d", textAlign: "center" }}>
          <Package size={48} style={{ color: "#8b949e", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 18, color: "#c9d1d9", marginBottom: 8 }}>Brak zamówień</h2>
          <p style={{ color: "#8b949e", fontSize: 14 }}>
            Zamówienia (Sub-Orders) tworzy się wewnątrz konkretnego Zlecenia. <br />
            Przejdź do wybranego Zlecenia i wybierz zakładkę "Zamówienia", aby je utworzyć.
          </p>
        </div>
      </div>
    </div>
  );
}
