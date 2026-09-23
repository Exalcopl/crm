"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Truck,
  Clock,
  DollarSign,
  FileText,
  Wrench,
  Package,
  Layers,
  CheckCircle2,
  XCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { ProductFormModal } from "../_components/ProductFormModal";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as Id<"products">;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const product = useQuery(api.products.get, { id: productId });
  const removeProduct = useMutation(api.products.remove);

  if (product === undefined) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 flex items-center justify-center text-gray-400">
        Ładowanie szczegółów pozycji...
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 space-y-4 text-center">
        <p className="text-gray-500 font-medium">Nie znaleziono produktu ani usługi o podanym ID.</p>
        <Link
          href="/admin/produkty"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Powrót do Katalogu
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm(`Czy na pewno chcesz usunąć tę pozycję: "${product.name}"?`)) return;
    try {
      await removeProduct({ id: productId });
      toast.success("Pozycja została usunięta.");
      router.push("/admin/produkty");
    } catch (err) {
      console.error(err);
      toast.error("Błąd podczas usuwania.");
    }
  };

  const getTypeBadge = (type: "product" | "service" | "outsourcing") => {
    switch (type) {
      case "outsourcing":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 border border-purple-200">
            <Wrench className="h-4 w-4" /> Obróbka Zewnętrzna (Outsourcing)
          </span>
        );
      case "service":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
            <Layers className="h-4 w-4" /> Usługa
          </span>
        );
      case "product":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            <Package className="h-4 w-4" /> Produkt / Materiał
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="space-y-2">
          <Link
            href="/admin/produkty"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Powrót do Katalogu Produktów i Usług
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900">{product.name}</h1>
            {getTypeBadge(product.type)}
            {product.isActive ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Aktywny
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                <XCircle className="h-3.5 w-3.5" /> Nieaktywny
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            <Edit3 className="h-4 w-4" /> Edytuj
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
          >
            <Trash2 className="h-4 w-4" /> Usuń
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <FileText className="h-5 w-5 text-blue-600" /> Podstawowe Informacje
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium block">Kod / SKU Wewnętrzny</span>
                <span className="text-sm font-bold text-gray-900">{product.code ?? "—"}</span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium block">Jednostka Miary</span>
                <span className="text-sm font-bold text-gray-900">{product.unit}</span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium block">Kategoria</span>
                <span className="text-sm font-bold text-gray-900">{product.category ?? "Główna"}</span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium block flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" /> Data Dodania
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  {new Date(product.createdAt).toLocaleDateString("pl-PL")}
                </span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium block flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" /> Ostatnia Aktualizacja
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  {new Date(product.updatedAt).toLocaleDateString("pl-PL")}
                </span>
              </div>
            </div>

            {/* Financial Card */}
            <div className="bg-gradient-to-br from-emerald-50/50 to-blue-50/50 p-5 rounded-xl border border-emerald-100/80 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" /> Warunki Cenowe Zakupu / Obróbki
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Cena Zakupu Netto</span>
                  <span className="text-xl font-black text-gray-900">
                    {product.priceNetto !== undefined
                      ? `${product.priceNetto.toFixed(2)} ${product.currency ?? "PLN"}`
                      : "Nieokreślono"}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-500 font-medium block">Stawka VAT</span>
                  <span className="text-lg font-bold text-gray-800">
                    {product.vatRate ?? 23}%
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-500 font-medium block">Cena Brutto</span>
                  <span className="text-xl font-black text-emerald-700">
                    {product.priceBrutto !== undefined
                      ? `${product.priceBrutto.toFixed(2)} ${product.currency ?? "PLN"}`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Parameters Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Sliders className="h-5 w-5 text-purple-600" /> Specyfikacja i Parametry Techniczne
            </h2>

            {!product.parameters || product.parameters.length === 0 ? (
              <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">
                Brak zdefiniowanych dodatkowych parametrów technicznych.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase font-semibold">
                      <th className="py-2.5 px-3">Parametr / Cecha</th>
                      <th className="py-2.5 px-3">Wartość</th>
                      <th className="py-2.5 px-3">Jednostka</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-gray-800">
                    {product.parameters.map((param, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{param.key}</td>
                        <td className="py-2.5 px-3">{param.value}</td>
                        <td className="py-2.5 px-3 text-gray-500">{param.unit ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Descriptions & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-2">
              <h3 className="text-sm font-bold text-gray-900">Opis Techniczny / Zakres Obróbki</h3>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {product.description || "Brak opisu."}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-2">
              <h3 className="text-sm font-bold text-gray-900">Notatki Wewnętrzne</h3>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {product.notes || "Brak wewnętrznych uwag."}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Supplier & Lead Time */}
        <div className="space-y-6">
          {/* Supplier Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Truck className="h-5 w-5 text-blue-600" /> Wykonawca / Dostawca
            </h2>

            {product.supplier ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{product.supplier.name}</h3>
                    <p className="text-xs text-gray-500">NIP: {product.supplier.nip}</p>
                  </div>
                  <Link
                    href="/admin/konfiguracje"
                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Przejdź do dostawcy"
                  >
                    <Building2 className="h-4 w-4" />
                  </Link>
                </div>

                {product.supplierCode && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-xs">
                    <span className="text-gray-500 font-medium block">Kod / SKU u Dostawcy</span>
                    <span className="font-bold text-blue-900">{product.supplierCode}</span>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                  {product.supplier.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span>{product.supplier.phone}</span>
                    </div>
                  )}
                  {product.supplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <span>{product.supplier.email}</span>
                    </div>
                  )}
                  {product.supplier.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      <span>{product.supplier.city}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50 rounded-xl space-y-2 border border-dashed border-gray-200">
                <Building2 className="h-8 w-8 text-gray-300 mx-auto" />
                <p className="text-xs text-gray-500 font-medium">Brak przypisanego dostawcy.</p>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  + Przypisz dostawcę
                </button>
              </div>
            )}
          </div>

          {/* Lead Time Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Clock className="h-5 w-5 text-amber-500" /> Czas Realizacji Obróbki
            </h2>

            {product.leadTimeDays !== undefined ? (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-center gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-2xl font-black text-amber-900">{product.leadTimeDays}</span>
                  <span className="text-xs font-bold text-amber-700 block">
                    {product.leadTimeDays === 1 ? "Dzień roboczy" : "Dni robocze"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nie podano deklarowanego czasu realizacji.</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal Edit */}
      <ProductFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        productToEdit={product}
      />
    </div>
  );
}
