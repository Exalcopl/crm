"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Plus, Trash2, Layers, Tag, DollarSign, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

interface ParameterItem {
  key: string;
  value: string;
  unit?: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: {
    _id: Id<"products">;
    name: string;
    code?: string;
    type: "product" | "service" | "outsourcing";
    description?: string;
    unit: string;
    supplierId?: Id<"suppliers">;
    supplierCode?: string;
    priceNetto?: number;
    priceBrutto?: number;
    vatRate?: number;
    currency?: string;
    leadTimeDays?: number;
    category?: string;
    parameters?: ParameterItem[];
    notes?: string;
    isActive: boolean;
  } | null;
  defaultSupplierId?: Id<"suppliers">;
}

const COMMON_UNITS = ["szt.", "mb.", "m²", "kg", "kpl.", "godz.", "usł."];
const CATEGORIES = [
  "Obróbka CNC",
  "Lakierowanie proszkowe",
  "Cięcie profili",
  "Spawanie",
  "Grawerowanie / Cechowanie",
  "Transport / Logistyka",
  "Profil aluminiowy",
  "Akcesoria i Okucia",
  "Wypełnienie / Szkło",
  "Inne",
];

export function ProductFormModal({
  isOpen,
  onClose,
  productToEdit,
  defaultSupplierId,
}: ProductFormModalProps) {
  const suppliers = useQuery(api.suppliers.list, { onlyActive: true });
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"product" | "service" | "outsourcing">("outsourcing");
  const [unit, setUnit] = useState("szt.");
  const [customUnit, setCustomUnit] = useState("");
  const [category, setCategory] = useState("Obróbka CNC");
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierCode, setSupplierCode] = useState("");
  const [priceNetto, setPriceNetto] = useState<string>("");
  const [vatRate, setVatRate] = useState<number>(23);
  const [currency, setCurrency] = useState("PLN");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [parameters, setParameters] = useState<ParameterItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCode(productToEdit.code ?? "");
      setType(productToEdit.type);
      if (COMMON_UNITS.includes(productToEdit.unit)) {
        setUnit(productToEdit.unit);
        setCustomUnit("");
      } else {
        setUnit("custom");
        setCustomUnit(productToEdit.unit);
      }
      setCategory(productToEdit.category ?? "Obróbka CNC");
      setSupplierId(productToEdit.supplierId ?? "");
      setSupplierCode(productToEdit.supplierCode ?? "");
      setPriceNetto(productToEdit.priceNetto !== undefined ? String(productToEdit.priceNetto) : "");
      setVatRate(productToEdit.vatRate ?? 23);
      setCurrency(productToEdit.currency ?? "PLN");
      setLeadTimeDays(productToEdit.leadTimeDays !== undefined ? String(productToEdit.leadTimeDays) : "");
      setDescription(productToEdit.description ?? "");
      setNotes(productToEdit.notes ?? "");
      setIsActive(productToEdit.isActive);
      setParameters(productToEdit.parameters ?? []);
    } else {
      setName("");
      setCode("");
      setType("outsourcing");
      setUnit("szt.");
      setCustomUnit("");
      setCategory("Obróbka CNC");
      setSupplierId(defaultSupplierId ?? "");
      setSupplierCode("");
      setPriceNetto("");
      setVatRate(23);
      setCurrency("PLN");
      setLeadTimeDays("");
      setDescription("");
      setNotes("");
      setIsActive(true);
      setParameters([]);
    }
  }, [productToEdit, defaultSupplierId, isOpen]);

  if (!isOpen) return null;

  const finalUnit = unit === "custom" ? customUnit.trim() : unit;
  const numNetto = priceNetto !== "" ? parseFloat(priceNetto) : undefined;
  const calculatedBrutto =
    numNetto !== undefined
      ? Math.round(numNetto * (1 + vatRate / 100) * 100) / 100
      : undefined;

  const handleAddParameter = () => {
    setParameters([...parameters, { key: "", value: "", unit: "" }]);
  };

  const handleRemoveParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleParameterChange = (
    index: number,
    field: keyof ParameterItem,
    val: string
  ) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: val };
    setParameters(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nazwa produktu/usługi jest wymagana.");
      return;
    }
    if (!finalUnit) {
      toast.error("Wybierz lub podaj jednostkę miary.");
      return;
    }

    setIsSubmitting(true);

    try {
      const validParameters = parameters.filter((p) => p.key.trim() !== "");
      const numLeadTime = leadTimeDays !== "" ? parseInt(leadTimeDays, 10) : undefined;

      if (productToEdit) {
        await updateProduct({
          id: productToEdit._id,
          name: name.trim(),
          code: code.trim() || undefined,
          type,
          unit: finalUnit,
          category,
          supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
          supplierCode: supplierCode.trim() || undefined,
          priceNetto: numNetto,
          priceBrutto: calculatedBrutto,
          vatRate,
          currency,
          leadTimeDays: numLeadTime,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          isActive,
          parameters: validParameters.length > 0 ? validParameters : undefined,
        });
        toast.success("Produkt/Usługa została zaktualizowana!");
      } else {
        await createProduct({
          name: name.trim(),
          code: code.trim() || undefined,
          type,
          unit: finalUnit,
          category,
          supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
          supplierCode: supplierCode.trim() || undefined,
          priceNetto: numNetto,
          priceBrutto: calculatedBrutto,
          vatRate,
          currency,
          leadTimeDays: numLeadTime,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          isActive,
          parameters: validParameters.length > 0 ? validParameters : undefined,
        });
        toast.success("Produkt/Usługa została dodana!");
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Wystąpił błąd podczas zapisu."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl border border-gray-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {productToEdit ? "Edycja Produktu / Usługi" : "Nowy Produkt / Usługa Obróbki"}
              </h2>
              <p className="text-xs text-gray-500">
                Skonfiguruj właściwości, powiąż dostawcę i ustal parametry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Typ i Aktywność */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Typ Pozycji *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "product" | "service" | "outsourcing")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="outsourcing">Obróbka Zewnętrzna (Outsourcing)</option>
                <option value="service">Usługa Zewnętrzna / Dojazd</option>
                <option value="product">Produkt / Komponent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Kategoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="relative flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-semibold text-gray-800">
                  Pozycja Aktywna
                </span>
              </label>
            </div>
          </div>

          {/* Dane podstawowe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nazwa Produktu / Usługi *
              </label>
              <input
                type="text"
                required
                placeholder="np. Lakierowanie proszkowe RAL 9016 MAT"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Kod / SKU (wewnętrzny)
              </label>
              <input
                type="text"
                placeholder="np. OBR-LAK-9016"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Jednostka miary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Jednostka Miary *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white focus:border-blue-500 focus:outline-none"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="custom">Własna jednostka...</option>
              </select>
            </div>

            {unit === "custom" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Wpisz Własną Jednostkę *
                </label>
                <input
                  type="text"
                  placeholder="np. komplet, m3, paleta"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Dostawca i powiązanie */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-600" />
              Przypisany Dostawca
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dostawca / Wykonawca Obróbki
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Brak / Wybierz dostawcę --</option>
                  {suppliers?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (NIP: {s.nip})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Kod u Dostawcy / SKU Wykonawcy
                </label>
                <input
                  type="text"
                  placeholder="np. SUP-9016-MAT"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ceny i Czas realizacji */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Cena i Czas Realizacji
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cena Zakupu Netto
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={priceNetto}
                  onChange={(e) => setPriceNetto(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Stawka VAT (%)
                </label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value={23}>23%</option>
                  <option value={8}>8%</option>
                  <option value={5}>5%</option>
                  <option value={0}>0% / zw.</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cena Brutto (wyliczona)
                </label>
                <input
                  type="text"
                  disabled
                  value={calculatedBrutto !== undefined ? `${calculatedBrutto.toFixed(2)} ${currency}` : "—"}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" /> Czas Realizacji (dni)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="np. 5"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Parametry techniczne */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                Parametry Techniczne i Warianty
              </h3>
              <button
                type="button"
                onClick={handleAddParameter}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Dodaj parametr
              </button>
            </div>

            {parameters.length === 0 ? (
              <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg text-center">
                Brak zdefiniowanych parametrów technicznych (np. Grubość powłoki, Kolor RAL, Max wymiar).
              </p>
            ) : (
              <div className="space-y-2">
                {parameters.map((param, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nazwa (np. Kolor RAL)"
                      value={param.key}
                      onChange={(e) =>
                        handleParameterChange(index, "key", e.target.value)
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Wartość (np. 9016)"
                      value={param.value}
                      onChange={(e) =>
                        handleParameterChange(index, "value", e.target.value)
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Jednostka (np. μm, mm)"
                      value={param.unit}
                      onChange={(e) =>
                        handleParameterChange(index, "unit", e.target.value)
                      }
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveParameter(index)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opis i Notatki */}
          <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Opis Techniczny / Specyfikacja
              </label>
              <textarea
                rows={3}
                placeholder="Opis usługi lub wymagania techniczne..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Notatki Wewnętrzne
              </label>
              <textarea
                rows={3}
                placeholder="Prywatne uwagi dla zespołu..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Zapisywanie..." : productToEdit ? "Zapisz Zmiany" : "Utwórz Pozycję"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
