"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  zabudowyBoczne: { typ: string; wariant: string | null }[] | { typ: string | null; wariant: string | null };
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
const DODATKI_ZADASZENIA = ["Promiennik ciepła"];

// ─── Listy opcji z bazy (źródło prawdy) z fallbackiem do stałych powyżej ────────

type LightingRec = Record<string, { label: string; opcje: string[] }>;
type Lists = {
  KOLORY: string[];
  RODZAJE_PERGOLI: string[];
  ORIENTACJE: string[];
  OSWIETLENIE_PERGOLA: LightingRec;
  ZABUDOWY_TYPY: string[];
  ZABUDOWY_WARIANTY: Record<string, string[]>;
  DODATKI_PERGOLA: string[];
  RODZAJE_ZADASZEN: string[];
  RODZAJE_DACHU: string[];
  OSWIETLENIE_ZADASZENIA: LightingRec;
  DODATKI_ZADASZENIA: string[];
};

const FALLBACK_LISTS: Lists = {
  KOLORY, RODZAJE_PERGOLI, ORIENTACJE, OSWIETLENIE_PERGOLA,
  ZABUDOWY_TYPY, ZABUDOWY_WARIANTY, DODATKI_PERGOLA,
  RODZAJE_ZADASZEN, RODZAJE_DACHU, OSWIETLENIE_ZADASZENIA, DODATKI_ZADASZENIA,
};

// Kształty zwracane przez api.configurator.getStructure
type CfgOption = { key: string; label: string; children: CfgOption[] };
type CfgField = { key: string; label: string; type: string; section: string; config?: unknown; options: CfgOption[] };
type CfgStructure = { fields: CfgField[] } | null | undefined;

function fieldByKey(s: CfgStructure, key: string): CfgField | undefined {
  return s?.fields.find((f) => f.key === key);
}
function labelsOf(s: CfgStructure, key: string): string[] | null {
  const f = fieldByKey(s, key);
  return f ? f.options.map((o) => o.label) : null;
}
function lightingRecordOf(s: CfgStructure): LightingRec | null {
  const rec: LightingRec = {};
  for (const f of s?.fields ?? []) {
    const grp = (f.config as { group?: string } | undefined)?.group;
    if (f.section === "Oświetlenie" && grp === "oswietlenie") {
      rec[f.key] = { label: f.label, opcje: f.options.map((o) => o.label) };
    }
  }
  return Object.keys(rec).length > 0 ? rec : null;
}
function enclosuresOf(s: CfgStructure): { typy: string[]; warianty: Record<string, string[]> } | null {
  const f = fieldByKey(s, "zabudowyBoczne");
  if (!f) return null;
  const warianty: Record<string, string[]> = {};
  for (const o of f.options) warianty[o.label] = o.children.map((c) => c.label);
  return { typy: f.options.map((o) => o.label), warianty };
}

function useConfiguratorLists(slug: "pergola" | "zadaszenia" | null): Lists {
  const structure = useQuery(
    api.configurator.getStructure,
    slug ? { slug } : "skip",
  ) as CfgStructure;

  return useMemo(() => {
    const L: Lists = { ...FALLBACK_LISTS };
    if (!structure) return L;

    const kolory = labelsOf(structure, "kolorKonstrukcji");
    if (kolory && kolory.length) L.KOLORY = kolory;

    const enc = enclosuresOf(structure);
    if (enc) { L.ZABUDOWY_TYPY = enc.typy; L.ZABUDOWY_WARIANTY = enc.warianty; }

    const light = lightingRecordOf(structure);

    if (slug === "pergola") {
      const rp = labelsOf(structure, "rodzajPergoli"); if (rp?.length) L.RODZAJE_PERGOLI = rp;
      const or = labelsOf(structure, "orientacja"); if (or?.length) L.ORIENTACJE = or;
      if (light) L.OSWIETLENIE_PERGOLA = light;
      const dod = labelsOf(structure, "dodatki"); if (dod?.length) L.DODATKI_PERGOLA = dod;
    } else if (slug === "zadaszenia") {
      const rz = labelsOf(structure, "rodzajZadaszenia"); if (rz?.length) L.RODZAJE_ZADASZEN = rz;
      const rd = labelsOf(structure, "dach"); if (rd?.length) L.RODZAJE_DACHU = rd;
      if (light) L.OSWIETLENIE_ZADASZENIA = light;
      const dod = labelsOf(structure, "dodatki"); if (dod?.length) L.DODATKI_ZADASZENIA = dod;
    }
    return L;
  }, [structure, slug]);
}

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
          style={{ accentColor: "#22A06B", width: 14, height: 14 }}
        />
      ) : (
        <span style={{
          width: 16, height: 16, borderRadius: 4, display: "inline-flex",
          alignItems: "center", justifyContent: "center", fontSize: 10,
          background: checked ? "#22A06B" : "var(--bg-overlay)",
          color: checked ? "#fff" : "var(--text-muted)",
          border: `1px solid ${checked ? "#22A06B" : "var(--border-subtle)"}`,
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

function PergolaView({ editing, draft, setDraft, lists }: {
  editing: boolean;
  draft: PergolaConfig;
  setDraft: (d: PergolaConfig) => void;
  lists: Lists;
}) {
  const wymDisplay = `${draft.wymiary.szerokosc} × ${draft.wymiary.wysieg} × ${draft.wymiary.wysokosc} cm`;

  return (
    <>
      <SectionLabel>Podstawowe</SectionLabel>

      <Row label="Rodzaj pergoli" value={draft.rodzajPergoli} editing={editing}>
        <SelectInput value={draft.rodzajPergoli} options={lists.RODZAJE_PERGOLI}
          onChange={(v) => setDraft({ ...draft, rodzajPergoli: v ?? "" })} />
      </Row>

      <Row label="Orientacja" value={draft.orientacja} editing={editing}>
        <SelectInput value={draft.orientacja} options={lists.ORIENTACJE}
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
        <SelectInput value={draft.kolorKonstrukcji} options={lists.KOLORY}
          onChange={(v) => setDraft({ ...draft, kolorKonstrukcji: v ?? "" })} />
      </Row>

      <Row label="Kolor dachu" value={draft.kolorDachu} editing={editing}>
        <SelectInput value={draft.kolorDachu} options={lists.KOLORY}
          onChange={(v) => setDraft({ ...draft, kolorDachu: v ?? "" })} />
      </Row>

      <SectionLabel>Oświetlenie</SectionLabel>
      {Object.entries(lists.OSWIETLENIE_PERGOLA).map(([key, { label, opcje }]) => {
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
        <SelectInput value={draft.zabudowyBoczne.typ} options={lists.ZABUDOWY_TYPY}
          onChange={(v) => setDraft({ ...draft, zabudowyBoczne: { typ: v, wariant: null } })} />
      </Row>
      <Row label="Wariant" value={draft.zabudowyBoczne.wariant ?? ""} editing={editing}>
        <SelectInput
          value={draft.zabudowyBoczne.wariant}
          options={draft.zabudowyBoczne.typ ? (lists.ZABUDOWY_WARIANTY[draft.zabudowyBoczne.typ] ?? []) : []}
          onChange={(v) => setDraft({ ...draft, zabudowyBoczne: { ...draft.zabudowyBoczne, wariant: v } })} />
      </Row>

      <SectionLabel>Dodatki</SectionLabel>
      {lists.DODATKI_PERGOLA.map((name) => {
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

function normalizeZabudowyList(val: unknown): { typ: string; wariant: string | null }[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.filter(Boolean).map((item: { typ?: unknown; wariant?: unknown }) => ({
      typ: String(item.typ ?? ""),
      wariant: item.wariant ? String(item.wariant) : null,
    }));
  }
  if (typeof val === "object" && val !== null && "typ" in val) {
    const obj = val as { typ?: unknown; wariant?: unknown };
    return [{ typ: String(obj.typ ?? ""), wariant: obj.wariant ? String(obj.wariant) : null }];
  }
  return [];
}

function ZadaszeniaView({ editing, draft, setDraft, lists }: {
  editing: boolean;
  draft: ZadaszeniaConfig;
  setDraft: (d: ZadaszeniaConfig) => void;
  lists: Lists;
}) {
  const zabudowyList = normalizeZabudowyList(draft.zabudowyBoczne);
  const wymDisplay =
    `${draft.wymiary.szerokosc} × ${draft.wymiary.wysieg} cm, ` +
    `wys. ${draft.wymiary.wysokoscWyzsza}/${draft.wymiary.wysokoscNizsza} cm`;

  return (
    <>
      <SectionLabel>Podstawowe</SectionLabel>

      <Row label="Rodzaj zadaszenia" value={draft.rodzajZadaszenia} editing={editing}>
        <SelectInput value={draft.rodzajZadaszenia} options={lists.RODZAJE_ZADASZEN}
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
        <SelectInput value={draft.dach} options={lists.RODZAJE_DACHU}
          onChange={(v) => setDraft({ ...draft, dach: v ?? "" })} />
      </Row>

      <Row label="Kolor konstrukcji" value={draft.kolorKonstrukcji} editing={editing}>
        <SelectInput value={draft.kolorKonstrukcji} options={lists.KOLORY}
          onChange={(v) => setDraft({ ...draft, kolorKonstrukcji: v ?? "" })} />
      </Row>

      <SectionLabel>Oświetlenie</SectionLabel>
      {Object.entries(lists.OSWIETLENIE_ZADASZENIA).map(([key, { label, opcje }]) => {
        const val = draft.oswietlenie[key] ?? null;
        return (
          <Row key={key} label={label} value={val ?? ""} editing={editing}>
            <SelectInput value={val} options={opcje}
              onChange={(v) => setDraft({ ...draft, oswietlenie: { ...draft.oswietlenie, [key]: v } })} />
          </Row>
        );
      })}

      <SectionLabel>Zabudowy boczne</SectionLabel>
      {editing ? (
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>Typy:</span>
            {lists.ZABUDOWY_TYPY.map((t) => {
              const exists = zabudowyList.some((z) => z.typ === t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    let next: { typ: string; wariant: string | null }[];
                    if (exists) {
                      next = zabudowyList.filter((z) => z.typ !== t);
                    } else {
                      next = [...zabudowyList, { typ: t, wariant: null }];
                    }
                    setDraft({ ...draft, zabudowyBoczne: next });
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: exists ? "1px solid #22A06B" : "1px solid var(--border-subtle)",
                    background: exists ? "#22A06B" : "var(--bg-base)",
                    color: exists ? "#fff" : "var(--text-primary)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: exists ? 600 : 400
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {zabudowyList.map((item) => {
            const warianty = lists.ZABUDOWY_WARIANTY[item.typ] ?? [];
            if (warianty.length === 0) return null;
            return (
              <Row key={item.typ} label={`Wariant – ${item.typ}`} value={item.wariant ?? ""} editing={true}>
                <SelectInput
                  value={item.wariant}
                  options={warianty}
                  onChange={(v) => {
                    const next = zabudowyList.map((z) => z.typ === item.typ ? { ...z, wariant: v } : z);
                    setDraft({ ...draft, zabudowyBoczne: next });
                  }}
                />
              </Row>
            );
          })}
        </div>
      ) : (
        zabudowyList.length === 0 ? (
          <Row label="Typy" value="Brak" editing={false} />
        ) : (
          zabudowyList.map((item, idx) => (
            <Row
              key={idx}
              label={zabudowyList.length === 1 ? "Zabudowa" : `Zabudowa ${idx + 1}`}
              value={item.wariant ? `${item.typ} (${item.wariant})` : item.typ}
              editing={false}
            />
          ))
        )
      )}

      <SectionLabel>Dodatki</SectionLabel>
      {lists.DODATKI_ZADASZENIA.map((name) => {
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
  const slug = cfg?.type === "pergola" || cfg?.type === "zadaszenia" ? cfg.type : null;
  const lists = useConfiguratorLists(slug);

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
            lists={lists}
          />
        ) : (
          <ZadaszeniaView
            editing={editing}
            draft={currentDraft as ZadaszeniaConfig}
            setDraft={(d) => setDraft(d)}
            lists={lists}
          />
        )}
      </div>
    </div>
  );
}
