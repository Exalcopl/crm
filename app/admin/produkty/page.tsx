"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Search,
  Plus,
  Filter,
  Layers,
  Truck,
  ExternalLink,
  Clock,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Wrench,
  Package,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { ProductFormModal } from "./_components/ProductFormModal";

type ProductType = "product" | "service" | "outsourcing";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [onlyActive, setOnlyActive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [productToEdit, setProductToEdit] = useState<any>(null);

  const suppliers = useQuery(api.suppliers.list, { onlyActive: true });
  const products = useQuery(api.products.list, {
    search: search.trim() || undefined,
    type: selectedType !== "all" ? (selectedType as ProductType) : undefined,
    supplierId: selectedSupplierId !== "all" ? (selectedSupplierId as Id<"suppliers">) : undefined,
    onlyActive: onlyActive || undefined,
  });

  const removeProduct = useMutation(api.products.remove);

  const handleDelete = async (id: Id<"products">, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć pozycję: "${name}"?`)) return;
    try {
      await removeProduct({ id });
      toast.success("Pozycja została usunięta.");
    } catch (err) {
      console.error(err);
      toast.error("Błąd podczas usuwania pozycji.");
    }
  };

  const getTypeBadge = (type: ProductType) => {
    switch (type) {
      case "outsourcing":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            <Wrench className="h-3 w-3" /> Obróbka Zewnętrzna
          </span>
        );
      case "service":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <Layers className="h-3 w-3" /> Usługa
          </span>
        );
      case "product":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <Package className="h-3 w-3" /> Produkt / Materiał
          </span>
        );
    }
  };

  const totalCount = products?.length ?? 0;
  const outsourcingCount = products?.filter((p) => p.type === "outsourcing").length ?? 0;
  const withSupplierCount = products?.filter((p) => p.supplierId).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Katalog Produktów i Usług Obróbki</h1>
            <p className="text-xs text-gray-500">
              Zarządzaj usługami obróbki zewnętrznej, wariantami technologicznymi i przypisanymi dostawcami.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setProductToEdit(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Dodaj Pozycję Obróbki
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Wszystkie Pozycje</p>
            <p className="text-2xl font-black text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Usługi Obróbki (Outsourcing)</p>
            <p className="text-2xl font-black text-gray-900">{outsourcingCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Z Przypisanym Dostawcą</p>
            <p className="text-2xl font-black text-gray-900">{withSupplierCount}</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj po nazwie, SKU, kodzie dostawcy, kategorii..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Filter className="h-3.5 w-3.5" /> Filtry:
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 bg-white focus:outline-none"
          >
            <option value="all">Wszystkie typy</option>
            <option value="outsourcing">Obróbka Zewnętrzna</option>
            <option value="service">Usługi</option>
            <option value="product">Produkty</option>
          </select>

          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 bg-white focus:outline-none"
          >
            <option value="all">Wszyscy Dostawcy</option>
            {suppliers?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Tylko aktywne
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {products === undefined ? (
          <div className="p-12 text-center text-gray-400">Ładowanie katalogu...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Boxes className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500 font-medium">Brak pozycji w katalogu.</p>
            <p className="text-xs text-gray-400">
              Nie znaleziono produktów ani usług spełniających kryteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nazwa & SKU</th>
                  <th className="py-3.5 px-4">Typ & Kategoria</th>
                  <th className="py-3.5 px-4">Dostawca</th>
                  <th className="py-3.5 px-4 text-right">Cena Netto</th>
                  <th className="py-3.5 px-4">Czas Realizacji</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                  >
                    <td className="py-4 px-4">
                      <Link
                        href={`/admin/produkty/${item._id}`}
                        className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5"
                      >
                        {item.name}
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {item.code && <span>SKU: {item.code}</span>}
                        <span>• Jednostka: {item.unit}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 space-y-1">
                      <div>{getTypeBadge(item.type)}</div>
                      {item.category && (
                        <span className="inline-block text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {item.supplier ? (
                        <div>
                          <Link
                            href="/admin/konfiguracje"
                            className="font-semibold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs"
                          >
                            <Truck className="h-3 w-3 text-gray-400" />
                            {item.supplier.name}
                          </Link>
                          {item.supplierCode && (
                            <span className="text-[11px] text-gray-500 block">
                              Kod dostawcy: {item.supplierCode}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Brak dostawcy</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right">
                      {item.priceNetto !== undefined ? (
                        <div>
                          <span className="font-bold text-gray-900">
                            {item.priceNetto.toFixed(2)} {item.currency ?? "PLN"}
                          </span>
                          <span className="text-[11px] text-gray-400 block">
                            +{item.vatRate}% VAT
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {item.leadTimeDays !== undefined ? (
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md w-max">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          {item.leadTimeDays} {item.leadTimeDays === 1 ? "dzień" : "dni"}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aktywny
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          <XCircle className="h-3.5 w-3.5" /> Nieaktywny
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right space-x-1">
                      <Link
                        href={`/admin/produkty/${item._id}`}
                        className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Widok szczegółów"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProductToEdit(item);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edytuj"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item._id, item.name);
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Usuń"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal form */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
      />
    </div>
  );
}
