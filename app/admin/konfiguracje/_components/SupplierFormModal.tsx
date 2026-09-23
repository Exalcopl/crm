"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  X,
  Loader2,
  Search,
  CheckCircle,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Clock,
  Tag,
  FileText,
  Link2,
} from "lucide-react";

interface Props {
  editingId: Id<"suppliers"> | null;
  onClose: () => void;
  onSuccess: (id: Id<"suppliers">) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 12,
  color: "#f0f6fc",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#8b949e",
  marginBottom: 4,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

export function SupplierFormModal({ editingId, onClose, onSuccess }: Props) {
  const existing = useQuery(
    api.suppliers.get,
    editingId ? { id: editingId } : "skip"
  );

  const createMut = useMutation(api.suppliers.create);
  const updateMut = useMutation(api.suppliers.update);
  const fetchFromGus = useAction(api.suppliers.fetchFromGus);

  // Form state
  const [nip, setNip] = useState("");
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [iban, setIban] = useState("");
  const [paymentDays, setPaymentDays] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [gusLoading, setGusLoading] = useState(false);
  const [gusStatus, setGusStatus] = useState<"idle" | "ok" | "error">("idle");
  const [gusMsg, setGusMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const nipRef = useRef<HTMLInputElement>(null);

  // Wypełnij formularz danymi istniejącego dostawcy
  useEffect(() => {
    if (existing) {
      setNip(existing.nip);
      setName(existing.name);
      setStreet(existing.street ?? "");
      setCity(existing.city ?? "");
      setPostalCode(existing.postalCode ?? "");
      setPhone(existing.phone ?? "");
      setEmail(existing.email ?? "");
      setIban(existing.iban ?? "");
      setPaymentDays(existing.paymentDays?.toString() ?? "");
      setCategory(existing.category ?? "");
      setNotes(existing.notes ?? "");
      setIsActive(existing.isActive);
    }
  }, [existing]);

  useEffect(() => {
    setTimeout(() => nipRef.current?.focus(), 80);
  }, []);

  async function handleGusLookup() {
    const nipDigits = nip.replace(/\D/g, "");
    if (nipDigits.length !== 10) {
      setGusStatus("error");
      setGusMsg("NIP musi mieć dokładnie 10 cyfr.");
      return;
    }
    setGusLoading(true);
    setGusStatus("idle");
    setGusMsg("");
    try {
      const result = await fetchFromGus({ nip: nipDigits });
      if (!result) {
        setGusStatus("error");
        setGusMsg("Nie znaleziono firmy o podanym NIP w Białej Liście MF.");
        return;
      }
      setName(result.name);
      if (result.street) setStreet(result.street);
      if (result.city) setCity(result.city);
      if (result.postalCode) setPostalCode(result.postalCode);
      setGusStatus("ok");
      setGusMsg("Dane pobrane z Białej Listy MF!");
    } catch (e) {
      setGusStatus("error");
      setGusMsg(e instanceof Error ? e.message : "Błąd pobierania danych.");
    } finally {
      setGusLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nip: nip.replace(/\D/g, ""),
        name,
        street: street || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        phone: phone || undefined,
        email: email || undefined,
        iban: iban || undefined,
        paymentDays: paymentDays ? parseInt(paymentDays) : undefined,
        category: category || undefined,
        notes: notes || undefined,
        isActive,
      };

      if (editingId) {
        await updateMut({ id: editingId, ...payload });
        toast.success("Zaktualizowano dane dostawcy");
        onSuccess(editingId);
      } else {
        const id = await createMut(payload);
        toast.success(`Dodano dostawcę „${name}"`);
        onSuccess(id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!editingId;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9990,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 12,
          width: "100%",
          maxWidth: 620,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #30363d",
            background: "#0d1117",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={16} style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <div
                style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}
              >
                {isEditing ? "Edytuj dostawcę" : "Dodaj nowego dostawcę"}
              </div>
              <div style={{ fontSize: 11, color: "#8b949e" }}>
                {isEditing
                  ? "Zmień dane dostawcy"
                  : "Wpisz NIP i pobierz dane z GUS lub uzupełnij ręcznie"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b949e",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form
          id="supplier-form"
          onSubmit={(e) => void handleSubmit(e)}
          style={{ overflowY: "auto", flex: 1, padding: 20 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* NIP + GUS */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                <CreditCard size={12} />
                NIP <span style={{ color: "#f85149" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={nipRef}
                  id="supplier-nip"
                  type="text"
                  value={nip}
                  onChange={(e) => {
                    setNip(e.target.value);
                    setGusStatus("idle");
                  }}
                  placeholder="np. 1234567890"
                  required
                  maxLength={13}
                  style={{ ...inputStyle, flex: 1, fontFamily: "monospace", letterSpacing: "0.05em" }}
                />
                <button
                  type="button"
                  id="supplier-gus-lookup"
                  onClick={() => void handleGusLookup()}
                  disabled={gusLoading}
                  title="Pobierz dane z Białej Listy MF"
                  style={{
                    background: "rgba(59,130,246,0.15)",
                    border: "1px solid rgba(59,130,246,0.35)",
                    borderRadius: 6,
                    color: "#60a5fa",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "8px 14px",
                    cursor: gusLoading ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    opacity: gusLoading ? 0.7 : 1,
                  }}
                >
                  {gusLoading ? (
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Search size={13} />
                  )}
                  Pobierz z GUS
                </button>
              </div>
              {gusStatus !== "idle" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: gusStatus === "ok" ? "#4ade80" : "#f85149",
                    marginTop: 5,
                  }}
                >
                  {gusStatus === "ok" ? (
                    <CheckCircle size={12} />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  {gusMsg}
                </div>
              )}
            </div>

            {/* Nazwa firmy */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                <Building2 size={12} />
                Nazwa firmy <span style={{ color: "#f85149" }}>*</span>
              </label>
              <input
                id="supplier-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="np. ACME Sp. z o.o."
                style={inputStyle}
              />
            </div>

            {/* Adres — 3 kolumny */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 10 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  <MapPin size={12} />
                  Kod pocztowy
                </label>
                <input
                  id="supplier-postal"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="00-000"
                  maxLength={6}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Miasto</label>
                <input
                  id="supplier-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Warszawa"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Ulica i numer</label>
                <input
                  id="supplier-street"
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="ul. Kowalska 5/10"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Kontakt */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  <Phone size={12} />
                  Telefon
                </label>
                <input
                  id="supplier-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+48 123 456 789"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  <Mail size={12} />
                  Email
                </label>
                <input
                  id="supplier-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kontakt@firma.pl"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* IBAN */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                <CreditCard size={12} />
                Numer konta IBAN
              </label>
              <input
                id="supplier-iban"
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="PL 61 1090 1014 0000 0712 1981 2874"
                style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.03em" }}
              />
            </div>

            {/* Płatność + Kategoria */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  <Clock size={12} />
                  Termin płatności (dni)
                </label>
                <input
                  id="supplier-payment-days"
                  type="number"
                  value={paymentDays}
                  onChange={(e) => setPaymentDays(e.target.value)}
                  placeholder="30"
                  min={0}
                  max={365}
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  <Tag size={12} />
                  Kategoria / branża
                </label>
                <input
                  id="supplier-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="np. Elektronika, Transport"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Notatki */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                <FileText size={12} />
                Notatki
              </label>
              <textarea
                id="supplier-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dodatkowe informacje o dostawcy…"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 70,
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <label
                htmlFor="supplier-active"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 12, color: "#c9d1d9", fontWeight: 600 }}>
                  Dostawca aktywny
                </span>
                <span style={{ fontSize: 11, color: "#8b949e" }}>
                  (nieaktywni są ukryci domyślnie na liście)
                </span>
              </label>
              <button
                type="button"
                id="supplier-active"
                onClick={() => setIsActive((v) => !v)}
                style={{
                  background: isActive ? "#238636" : "#30363d",
                  border: "none",
                  borderRadius: 20,
                  width: 40,
                  height: 22,
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: isActive ? 20 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "14px 20px",
            borderTop: "1px solid #30363d",
            background: "#0d1117",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #30363d",
              borderRadius: 6,
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >
            Anuluj
          </button>
          <button
            type="submit"
            form="supplier-form"
            id="supplier-submit"
            disabled={saving}
            style={{
              background: saving ? "#1f6feb" : "#238636",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 22px",
              cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.15s",
            }}
          >
            {saving && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {isEditing ? "Zapisz zmiany" : "Dodaj dostawcę"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
