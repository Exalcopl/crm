"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

type PergolaConfig = {
  type: "pergola";
  rodzajPergoli: string;
  orientacja: string;
  wymiary: { szerokosc: number; wysieg: number; wysokosc: number };
  kolorKonstrukcji: string;
  kolorDachu: string;
  oswietlenie: Record<string, string | null>;
  zabudowyBoczne: { typ: string | null; wariant: string | null };
  dodatki: string[];
};

type ZadaszeniaConfig = {
  type: "zadaszenia";
  rodzajZadaszenia: string;
  wymiary: { szerokosc: number; wysieg: number; wysokoscWyzsza: number; wysokoscNizsza: number };
  dach: string;
  kolorKonstrukcji: string;
  oswietlenie: Record<string, string | null>;
  zabudowyBoczne: { typ: string | null; wariant: string | null };
  dodatki: string[];
};

type QuoteConfig = PergolaConfig | ZadaszeniaConfig;

// ─── Option lists (mirrors website products.ts) ───────────────────────────────

const KOLORY = [
  "Antracyt RAL 7016", "Czarny mat RAL 9005", "Biały RAL 9016", "Srebrny RAL 9006",
  "Brąz RAL 8017", "Zielony RAL 6005", "Grafit RAL 7024",
  "Złoty dąb", "Orzech", "Biały połysk",
];

const RODZAJE_PERGOLI = ["Przyścienna", "Wolnostojąca", "Opaska betonowa"];
const ORIENTACJE = ["Lewa", "Prawa"];
const OSWIETLENIE_OPCJE = ["Białe – zimny", "Białe – neutralny", "Białe – ciepły", "RGB"];
const OSWIETLENIE_PUNKTOWE = ["Białe – zimny", "Białe – neutralny", "Białe – ciepły"];

const OSWIETLENIE_PERGOLA: Record<string, { label: string; opcje: string[] }> = {
  "liniowe-obwod": { label: "Liniowe po obwodzie", opcje: OSWIETLENIE_OPCJE },
  "liniowe-lamelach": { label: "Liniowe w lamelach", opcje: OSWIETLENIE_OPCJE },
  "punktowe-lamelach": { label: "Punktowe w lamelach", opcje: OSWIETLENIE_PUNKTOWE },
};

const OSWIETLENIE_ZADASZENIA: Record<string, { label: string; opcje: string[] }> = {
  "liniowe-krokwie": { label: "Liniowe w krokwiach", opcje: OSWIETLENIE_OPCJE },
  "punktowe-krokwie": { label: "Punktowe w krokwiach", opcje: OSWIETLENIE_PUNKTOWE },
};

const ZABUDOWY_TYPY = ["Stałe", "Przesuwne", "Shuttersy", "Zippy"];
const ZABUDOWY_WARIANTY: Record<string, string[]> = {
  "Stałe": ["Wzór 1", "Wzór 2", "Wzór 3"],
  "Przesuwne": ["Całoszklane", "Aluminiowe"],
  "Shuttersy": ["Pionowe", "Poziome"],
  "Zippy": ["Wzór 1", "Wzór 2"],
};

const DODATKI_PERGOLA = ["Czujnik deszczu", "Czujnik wiatru", "Promiennik ciepła"];
const RODZAJE_ZADASZEN = ["Przyścienne", "Wolnostojące"];
const RODZAJE_DACHU = ["Szkło", "Poliwęglan", "Panel nieprzezierny", "Inne"];
const DODATKI_ZADASZENIA = ["Promiennik ciepła", "COŚTAM1", "COŚTAM2"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wymMm(v: number) {
  return `${v} cm`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      color: "var(--text-muted)", textTransform: "uppercase",
      padding: "8px 16px 4px",
      borderTop: "1px solid var(--border-subtle)",
      marginTop: 2,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value, editing, children }: {
  label: string;
  value: string;
  editing?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr",
      gap: 8,
      padding: "5px 16px",
      alignItems: "center",
      fontSize: 13,
    }}>
      <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      {editing && children ? children : (
        <span style={{
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          fontStyle: value ? "normal" : "italic",
        }}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function SelectInput({ value, options, onChange }: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      style={{
        width: "100%", fontSize: 13, padding: "3px 6px",
        background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
        borderRadius: 5, color: "var(--text-primary)", outline: "none",
      }}
    >
      <option value="">—</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      step={10}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        width: "80px", fontSize: 13, padding: "3px 6px",
        background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
        borderRadius: 5, color: "var(--text-primary)", outline: "none",
      }}
    />
  );
}

function AddonRow({ name, checked, editing, onChange }: {
  name: string;
  checked: boolean;
  editing: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 16px", fontSize: 13,
    }}>
      {editing ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          style={{ accentColor: "#DD3333", width: 14, height: 14 }}
        />
      ) : (
        <span style={{
          width: 16, height: 16, borderRadius: 4, display: "inline-flex",
          alignItems: "center", justifyContent: "center", fontSize: 10,
          background: checked ? "#DD3333" : "var(--bg-overlay)",
          color: checked ? "#fff" : "var(--text-muted)",
          border: `1px solid ${checked ? "#DD3333" : "var(--border-subtle)"}`,
          flexShrink: 0,
        }}>
          {checked ? "✓" : ""}
        </span>
      )}
      <span style={{
        color: checked ? "var(--text-primary)" : "var(--text-muted)",
        fontWeight: checked ? 500 : 400,
      }}>
        {name}
      </span>
    </div>
  );
}

// ─── Pergola display / edit ───────────────────────────────────────────────────

function PergolaView({ editing, draft, setDraft }: {
  editing: boolean;
  draft: PergolaConfig;
  setDraft: (d: PergolaConfig) => void;
}) {
  const wymDisplay = `${draft.wymiary.szerokosc} × ${draft.wymiary.wysieg} × ${draft.wymiary.wysokosc} cm`;

  return (
    <>
      <SectionLabel>Podstawowe</SectionLabel>

      <Row label="Rodzaj pergoli" value={draft.rodzajPergoli} editing={editing}>
        <SelectInput value={draft.rodzajPergoli} options={RODZAJE_PERGOLI}
          onChange={(v) => setDraft({ ...draft, rodzajPergoli: v ?? "" })} />
      </Row>

      <Row label="Orientacja" value={draft.orientacja} editing={editing}>
        <SelectInput value={draft.orientacja} options={ORIENTACJE}
          onChange={(v) => setDraft({ ...draft, orientacja: v ?? "" })} />
      </Row>

      <Row label="Wymiary" value={wymDisplay} editing={editing}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Szer.</span>
            <NumberInput value={draft.wymiary.szerokosc}
              onChange={(v) => setDraft({ ...draft, wymiary: { ...draft.wymiary, szerokosc: v } })} />
          </div>
          <span style={{ color: "var(--text-muted)", paddingTop: 14 }}>×</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Wysięg</span>
            <NumberInput value={draft.wymiary.wysieg}
              onChange={(v) => setDraft({ ...draft, wymiary: { ...draft.wymiary, wysieg: v } })} />
          </div>
          <span style={{ color: "var(--text-muted)", paddingTop: 14 }}>×</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Wys.</span>
            <NumberInput value={draft.wymiary.wysokosc}
              onChange={(v) => setDraft({ ...draft, wymiary: { ...draft.wymiary, wysokosc: v } })} />
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: 11, paddingTop: 14 }}>cm</span>
        </div>
      </Row>

      <Row label="Kolor konstrukcji" value={draft.kolorKonstrukcji} editing={editing}>
        <SelectInput value={draft.kolorKonstrukcji} options={KOLORY}
          onChange={(v) => setDraft({ ...draft, kolorKonstrukcji: v ?? "" })} />
      </Row>

      <Row label="Kolor dachu" value={draft.kolorDachu} editing={editing}>
        <SelectInput value={draft.kolorDachu} options={KOLORY}
          onChange={(v) => setDraft({ ...draft, kolorDachu: v ?? "" })} />
      </Row>

      <SectionLabel>Oświetlenie</SectionLabel>
      {Object.entries(OSWIETLENIE_PERGOLA).map(([key, { label, opcje }]) => {
        const val = draft.oswietlenie[key] ?? null;
        return (
          <Row key={key} label={label} value={val ?? ""} editing={editing}>
            <SelectInput value={val} options={opcje}
              onChange={(v) => setDraft({ ...draft, oswietlenie: { ...draft.oswietlenie, [key]: v } })} />
          </Row>
        );
      })}

      <SectionLabel>Zabudowy boczne</SectionLabel>
      <Row label="Typ" value={draft.zabudowyBoczne.typ ?? ""} editing={editing}>
        <SelectInput value={draft.zabudowyBoczne.typ} options={ZABUDOWY_TYPY}
          onChange={(v) => setDraft({ ...draft, zabudowyBoczne: { typ: v, wariant: null } })} />
      </Row>
      <Row label="Wariant" value={draft.zabudowyBoczne.wariant ?? ""} editing={editing}>
        <SelectInput
          value={draft.zabudowyBoczne.wariant}
          options={draft.zabudowyBoczne.typ ? (ZABUDOWY_WARIANTY[draft.zabudowyBoczne.typ] ?? []) : []}
          onChange={(v) => setDraft({ ...draft, zabudowyBoczne: { ...draft.zabudowyBoczne, wariant: v } })} />
      </Row>

      <SectionLabel>Dodatki</SectionLabel>
      {DODATKI_PERGOLA.map((name) => {
        const checked = draft.dodatki.includes(name);
        return (
          <AddonRow key={name} name={name} checked={checked} editing={editing}
            onChange={(v) => setDraft({
              ...draft,
              dodatki: v
                ? [...draft.dodatki, name]
                : draft.dodatki.filter((d) => d !== name),
            })} />
        );
      })}
    </>
  );
}

// ─── Zadaszenia display / edit ────────────────────────────────────────────────

function ZadaszeniaView({ editing, draft, setDraft }: {
  editing: boolean;
  draft: ZadaszeniaConfig;
  setDraft: (d: ZadaszeniaConfig) => void;
}) {
  const wymDisplay =
    `${draft.wymiary.szerokosc} × ${draft.wymiary.wysieg} cm, ` +
    `wys. ${draft.wymiary.wysokoscWyzsza}/${draft.wymiary.wysokoscNizsza} cm`;

  return (
    <>
      <SectionLabel>Podstawowe</SectionLabel>

      <Row label="Rodzaj zadaszenia" value={draft.rodzajZadaszenia} editing={editing}>
        <SelectInput value={draft.rodzajZadaszenia} options={RODZAJE_ZADASZEN}
          onChange={(v) => setDraft({ ...draft, rodzajZadaszenia: v ?? "" })} />
      </Row>

      <Row label="Wymiary" value={wymDisplay} editing={editing}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {([
            ["Szer.", "szerokosc"],
            ["Wysięg", "wysieg"],
            ["Wys. wyż.", "wysokoscWyzsza"],
            ["Wys. niż.", "wysokoscNizsza"],
          ] as [string, keyof typeof draft.wymiary][]).map(([lbl, key]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{lbl}</span>
              <NumberInput value={draft.wymiary[key]}
                onChange={(v) => setDraft({ ...draft, wymiary: { ...draft.wymiary, [key]: v } })} />
            </div>
          ))}
          <span style={{ color: "var(--text-muted)", fontSize: 11, paddingTop: 14 }}>cm</span>
        </div>
      </Row>

      <Row label="Dach" value={draft.dach} editing={editing}>
        <SelectInput value={draft.dach} options={RODZAJE_DACHU}
          onChange={(v) => setDraft({ ...draft, dach: v ?? "" })} />
      </Row>

      <Row label="Kolor konstrukcji" value={draft.kolorKonstrukcji} editing={editing}>
        <SelectInput value={draft.kolorKonstrukcji} options={KOLORY}
          onChange={(v) => setDraft({ ...draft, kolorKonstrukcji: v ?? "" })} />
      </Row>

      <SectionLabel>Oświetlenie</SectionLabel>
      {Object.entries(OSWIETLENIE_ZADASZENIA).map(([key, { label, opcje }]) => {
        const val = draft.oswietlenie[key] ?? null;
        return (
          <Row key={key} label={label} value={val ?? ""} editing={editing}>
            <SelectInput value={val} options={opcje}
              onChange={(v) => setDraft({ ...draft, oswietlenie: { ...draft.oswietlenie, [key]: v } })} />
          </Row>
        );
      })}

      <SectionLabel>Zabudowy boczne</SectionLabel>
      <Row label="Typ" value={draft.zabudowyBoczne.typ ?? ""} editing={editing}>
        <SelectInput value={draft.zabudowyBoczne.typ} options={ZABUDOWY_TYPY}
          onChange={(v) => setDraft({ ...draft, zabudowyBoczne: { typ: v, wariant: null } })} />
      </Row>
      <Row label="Wariant" value={draft.zabudowyBoczne.wariant ?? ""} editing={editing}>
        <SelectInput
          value={draft.zabudowyBoczne.wariant}
          options={draft.zabudowyBoczne.typ ? (ZABUDOWY_WARIANTY[draft.zabudowyBoczne.typ] ?? []) : []}
          onChange={(v) => setDraft({ ...draft, zabudowyBoczne: { ...draft.zabudowyBoczne, wariant: v } })} />
      </Row>

      <SectionLabel>Dodatki</SectionLabel>
      {DODATKI_ZADASZENIA.map((name) => {
        const checked = draft.dodatki.includes(name);
        return (
          <AddonRow key={name} name={name} checked={checked} editing={editing}
            onChange={(v) => setDraft({
              ...draft,
              dodatki: v
                ? [...draft.dodatki, name]
                : draft.dodatki.filter((d) => d !== name),
            })} />
        );
      })}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteConfiguration({
  quoteId,
  configuration,
  archived,
}: {
  quoteId: Id<"quotes">;
  configuration: unknown;
  archived: boolean;
}) {
  const cfg = configuration as QuoteConfig | null | undefined;
  const updateConfiguration = useMutation(api.quotes.updateConfiguration);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuoteConfig | null>(null);
  const [saving, setSaving] = useState(false);

  if (!cfg || (cfg.type !== "pergola" && cfg.type !== "zadaszenia")) {
    return (
      <div style={{ padding: "24px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          Brak danych z konfiguratora
        </div>
      </div>
    );
  }

  const currentDraft = (draft ?? cfg) as typeof cfg;

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(cfg)));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    try {
      await updateConfiguration({ id: quoteId, configuration: draft });
      toast.success("Konfiguracja zapisana");
      setEditing(false);
      setDraft(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  const typeLabel = cfg.type === "pergola" ? "Pergola" : "Zadaszenie";

  return (
    <div style={{ fontSize: 13 }}>
      {/* Header inside box */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px",
        background: "var(--bg-titlebar)",
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>
          KONFIGURACJA — {typeLabel.toUpperCase()}
        </span>
        {!archived && (
          <div style={{ display: "flex", gap: 4 }}>
            {editing ? (
              <>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 5, cursor: "pointer",
                    background: "#DD3333", color: "#fff", border: "none", fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Zapisywanie…" : "Zapisz"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 5, cursor: "pointer",
                    background: "transparent", color: "var(--text-muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  Anuluj
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 5, cursor: "pointer",
                  background: "transparent", color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                Edytuj
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ paddingBottom: 8 }}>
        {cfg.type === "pergola" ? (
          <PergolaView
            editing={editing}
            draft={currentDraft as PergolaConfig}
            setDraft={(d) => setDraft(d)}
          />
        ) : (
          <ZadaszeniaView
            editing={editing}
            draft={currentDraft as ZadaszeniaConfig}
            setDraft={(d) => setDraft(d)}
          />
        )}
      </div>
    </div>
  );
}
