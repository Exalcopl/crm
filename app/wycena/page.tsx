"use client";

import { useMemo, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FilePicker } from "@/app/_components/file-picker";

type AnswerType = "text" | "boolean" | "number";

type ActiveType = {
  _id: Id<"projectTypes">;
  name: string;
  color: string;
};

type QuestionRow = {
  _id: Id<"projectTypeQuestions">;
  projectTypeId: Id<"projectTypes">;
  text: string;
  answerType: AnswerType;
  units?: string[];
  isRequired: boolean;
};

type AnswerValue =
  | { text?: string }
  | { boolean?: boolean }
  | { number?: number; unit?: string };

type SubmitStage =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "waitingFolder" }
  | { kind: "uploading"; done: number; total: number }
  | {
      kind: "done";
      code: string;
      filesUploaded: number;
      filesTotal: number;
      folderReady: boolean;
    };

function isoFromOffsetDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function PublicQuotePage() {
  const convex = useConvex();
  const createPublic = useMutation(api.quotes.createPublic);
  const createUpload = useAction(api.sharepoint.createPublicUploadSession);
  const activeTypesRaw = useQuery(api.projectTypes.listActive) as
    | ActiveType[]
    | undefined;
  const activeTypes = useMemo(() => activeTypesRaw ?? [], [activeTypesRaw]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [investmentAddress, setInvestmentAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [files, setFiles] = useState<File[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Id<"projectTypes">[]>([]);
  const [answers, setAnswers] = useState<
    Record<string, AnswerValue>
  >({});
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stage, setStage] = useState<SubmitStage>({ kind: "idle" });

  const questionsRaw = useQuery(
    api.projectTypeQuestions.listActiveByTypes,
    selectedTypes.length > 0
      ? { projectTypeIds: selectedTypes }
      : "skip",
  ) as QuestionRow[] | undefined;
  const questions = useMemo(() => questionsRaw ?? [], [questionsRaw]);

  const selectedTypesByName = useMemo(() => {
    const set = new Set(selectedTypes.map((id) => id as unknown as string));
    return activeTypes.filter((t) =>
      set.has(t._id as unknown as string),
    );
  }, [selectedTypes, activeTypes]);

  function toggleType(id: Id<"projectTypes">) {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function setAnswer(qid: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  const groupedQuestions = useMemo(() => {
    const map = new Map<string, QuestionRow[]>();
    for (const q of questions) {
      const key = q.projectTypeId as unknown as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    const groups: { type: ActiveType; qs: QuestionRow[] }[] = [];
    for (const t of selectedTypesByName) {
      const qs = map.get(t._id as unknown as string) ?? [];
      if (qs.length > 0) groups.push({ type: t, qs });
    }
    return groups;
  }, [questions, selectedTypesByName]);

  const nameValid = name.trim().length > 0;
  const contactValid = phone.trim().length > 0 || email.trim().length > 0;
  const typesValid = selectedTypes.length > 0;
  const requiredAnswersValid = useMemo(() => {
    for (const q of questions) {
      if (!q.isRequired) continue;
      const a = answers[q._id as unknown as string];
      if (!a) return false;
      if (q.answerType === "text") {
        if (!("text" in a) || !a.text || !a.text.trim()) return false;
      } else if (q.answerType === "boolean") {
        if (!("boolean" in a) || typeof a.boolean !== "boolean") return false;
      } else {
        if (!("number" in a) || typeof a.number !== "number") return false;
      }
    }
    return true;
  }, [questions, answers]);

  const canSubmit =
    nameValid &&
    contactValid &&
    typesValid &&
    requiredAnswersValid &&
    stage.kind === "idle";

  async function waitForFolder(
    quoteId: Id<"quotes">,
    token: string,
  ): Promise<boolean> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const status = await convex.query(api.quotes.getPublicStatus, {
        quoteId,
        token,
      });
      if (status?.sharepointStatus === "created") return true;
      if (status?.sharepointStatus === "failed") return false;
      await new Promise((r) => setTimeout(r, 1200));
    }
    return false;
  }

  async function uploadFile(
    quoteId: Id<"quotes">,
    token: string,
    file: File,
  ) {
    const { uploadUrl } = await createUpload({
      quoteId,
      token,
      fileName: file.name,
      fileSize: file.size,
    });
    const headers: Record<string, string> = {
      "Content-Length": String(file.size),
    };
    if (file.size > 0) {
      headers["Content-Range"] = `bytes 0-${file.size - 1}/${file.size}`;
    }
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file,
    });
    if (!res.ok && res.status !== 201) {
      throw new Error(`Upload ${res.status}`);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (!canSubmit) return;

    try {
      setStage({ kind: "creating" });
      const projectTypeNames = selectedTypesByName.map((t) => t.name);
      const answerPayload: Array<{
        questionId: Id<"projectTypeQuestions">;
        textValue?: string;
        booleanValue?: boolean;
        numberValue?: number;
        numberUnit?: string;
      }> = [];
      for (const q of questions) {
        const a = answers[q._id as unknown as string];
        if (!a) continue;
        if (q.answerType === "text" && "text" in a && a.text?.trim()) {
          answerPayload.push({
            questionId: q._id,
            textValue: a.text.trim(),
          });
        } else if (
          q.answerType === "boolean" &&
          "boolean" in a &&
          typeof a.boolean === "boolean"
        ) {
          answerPayload.push({
            questionId: q._id,
            booleanValue: a.boolean,
          });
        } else if (
          q.answerType === "number" &&
          "number" in a &&
          typeof a.number === "number"
        ) {
          answerPayload.push({
            questionId: q._id,
            numberValue: a.number,
            numberUnit: a.unit,
          });
        }
      }

      const result = await createPublic({
        contact: {
          name: name.trim(),
          street: street.trim() || undefined,
          postalCity: postalCity.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        },
        projectType: projectTypeNames,
        investment: investmentAddress.trim()
          ? { address: investmentAddress.trim() }
          : undefined,
        deadline: deadline || undefined,
        description: description.trim() || undefined,
        answers: answerPayload,
        website, // honeypot — wartość puste w przypadku człowieka
      });

      let uploadedCount = 0;
      let folderReady = false;
      if (files.length > 0) {
        setStage({ kind: "waitingFolder" });
        folderReady = await waitForFolder(result.quoteId, result.uploadToken);
        if (folderReady) {
          setStage({
            kind: "uploading",
            done: 0,
            total: files.length,
          });
          for (let i = 0; i < files.length; i++) {
            try {
              await uploadFile(result.quoteId, result.uploadToken, files[i]);
              uploadedCount += 1;
            } catch (err) {
              console.error("[public upload]", err);
            }
            setStage({
              kind: "uploading",
              done: i + 1,
              total: files.length,
            });
          }
        }
      } else {
        folderReady = true;
      }

      setStage({
        kind: "done",
        code: result.code,
        filesUploaded: uploadedCount,
        filesTotal: files.length,
        folderReady,
      });
    } catch (err) {
      console.error(err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Coś poszło nie tak. Spróbuj jeszcze raz lub zadzwoń do nas.",
      );
      setStage({ kind: "idle" });
    }
  }

  if (stage.kind === "done") {
    return <ThankYou stage={stage} />;
  }

  const showError = (kind: "name" | "contact" | "types" | "answers"): boolean => {
    if (!touched) return false;
    if (kind === "name") return !nameValid;
    if (kind === "contact") return !contactValid;
    if (kind === "types") return !typesValid;
    return !requiredAnswersValid;
  };

  return (
    <main className="wp-main">
      <h1 className="wp-hero-title">Wyceń projekt</h1>
      <p className="wp-hero-sub">
        Wypełnij krótki formularz, a odezwiemy się z wyceną. Im więcej
        szczegółów podasz, tym szybciej przygotujemy ofertę.
      </p>

      <form className="wp-form" onSubmit={submit} noValidate>
        {/* 1. Kontakt */}
        <section className="wp-section">
          <header className="wp-section-head">
            <h2 className="wp-section-title">
              <span className="wp-section-num">1</span>
              <span>Dane kontaktowe</span>
            </h2>
          </header>
          <div className="wp-grid">
            <label className="wp-field wp-field-full">
              <span className="wp-label wp-label-required">Imię / firma</span>
              <input
                className="wp-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Jan Kowalski / ProBud Inwestycje"
                autoComplete="name"
                required
              />
              {showError("name") && (
                <span className="wp-error">Podaj imię lub nazwę firmy.</span>
              )}
            </label>
            <label className="wp-field">
              <span className="wp-label">Telefon</span>
              <input
                className="wp-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+48 600 000 000"
                autoComplete="tel"
              />
            </label>
            <label className="wp-field">
              <span className="wp-label">E-mail</span>
              <input
                className="wp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adres@firma.pl"
                autoComplete="email"
              />
            </label>
            {showError("contact") && (
              <div className="wp-field wp-field-full">
                <span className="wp-error">
                  Podaj telefon lub e-mail — musimy mieć jak się odezwać.
                </span>
              </div>
            )}
            <label className="wp-field">
              <span className="wp-label">Ulica</span>
              <input
                className="wp-input"
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="ul. Kwiatowa 12"
                autoComplete="street-address"
              />
            </label>
            <label className="wp-field">
              <span className="wp-label">Kod, miasto</span>
              <input
                className="wp-input"
                type="text"
                value={postalCity}
                onChange={(e) => setPostalCity(e.target.value)}
                placeholder="00-001 Warszawa"
              />
            </label>
          </div>

          {/* honeypot */}
          <div className="wp-honeypot" aria-hidden="true">
            <label>
              Strona www (zostaw puste)
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* 2. Typ projektu */}
        <section className="wp-section">
          <header className="wp-section-head">
            <h2 className="wp-section-title">
              <span className="wp-section-num">2</span>
              <span>Co chciałbyś wycenić?</span>
            </h2>
            <span className="wp-section-hint">możesz wybrać kilka</span>
          </header>
          <div className="wp-type-grid">
            {activeTypes.map((t) => {
              const active = selectedTypes.includes(t._id);
              return (
                <button
                  key={t._id as unknown as string}
                  type="button"
                  className={`wp-type-btn${active ? " is-active" : ""}`}
                  onClick={() => toggleType(t._id)}
                  aria-pressed={active}
                >
                  <span
                    className="wp-type-dot"
                    style={{ background: t.color }}
                  />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
          {showError("types") && (
            <span className="wp-error">Wybierz co najmniej jeden typ projektu.</span>
          )}
        </section>

        {/* 3. Pytania pomocnicze (jeśli są) */}
        {groupedQuestions.length > 0 && (
          <section className="wp-section">
            <header className="wp-section-head">
              <h2 className="wp-section-title">
                <span className="wp-section-num">3</span>
                <span>Doprecyzowanie</span>
              </h2>
            </header>
            {groupedQuestions.map(({ type, qs }) => (
              <div key={type._id as unknown as string} className="wp-q-group">
                <div className="wp-q-group-head">
                  <span
                    className="wp-type-dot"
                    style={{ background: type.color }}
                  />
                  <span>{type.name}</span>
                </div>
                <div className="wp-q-list">
                  {qs.map((q) => (
                    <QuestionField
                      key={q._id as unknown as string}
                      q={q}
                      answer={answers[q._id as unknown as string]}
                      onChange={(v) =>
                        setAnswer(q._id as unknown as string, v)
                      }
                      touched={touched}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 4. Inwestycja + termin */}
        <section className="wp-section">
          <header className="wp-section-head">
            <h2 className="wp-section-title">
              <span className="wp-section-num">
                {groupedQuestions.length > 0 ? 4 : 3}
              </span>
              <span>Inwestycja i termin</span>
            </h2>
            <span className="wp-section-hint">opcjonalnie</span>
          </header>
          <div className="wp-grid">
            <label className="wp-field wp-field-full">
              <span className="wp-label">Adres inwestycji (jeśli inny niż kontaktowy)</span>
              <input
                className="wp-input"
                type="text"
                value={investmentAddress}
                onChange={(e) => setInvestmentAddress(e.target.value)}
                placeholder="np. ul. Słoneczna 5, Kraków"
              />
            </label>
            <label className="wp-field">
              <span className="wp-label">Kiedy potrzebujesz?</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "Brak", days: null },
                  { label: "+14 dni", days: 14 },
                  { label: "+30 dni", days: 30 },
                  { label: "+60 dni", days: 60 },
                ].map((opt) => {
                  const iso = opt.days === null ? "" : isoFromOffsetDays(opt.days);
                  const active = deadline === iso;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      className={`wp-type-btn${active ? " is-active" : ""}`}
                      onClick={() => setDeadline(iso)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </label>
            <label className="wp-field">
              <span className="wp-label">…lub konkretna data</span>
              <input
                className="wp-input"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={isoFromOffsetDays(0)}
              />
            </label>
          </div>
        </section>

        {/* 5. Opis */}
        <section className="wp-section">
          <header className="wp-section-head">
            <h2 className="wp-section-title">
              <span className="wp-section-num">
                {groupedQuestions.length > 0 ? 5 : 4}
              </span>
              <span>Opis projektu</span>
            </h2>
            <span className="wp-section-hint">opcjonalnie</span>
          </header>
          <label className="wp-field">
            <span className="wp-label">Co powinniśmy wiedzieć?</span>
            <textarea
              className="wp-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="np. zadaszenie tarasu 4 × 3 m, montaż wiosną, materiał aluminium"
              rows={4}
            />
          </label>
        </section>

        {/* 6. Pliki */}
        <section className="wp-section">
          <header className="wp-section-head">
            <h2 className="wp-section-title">
              <span className="wp-section-num">
                {groupedQuestions.length > 0 ? 6 : 5}
              </span>
              <span>Pliki projektowe i zdjęcia</span>
            </h2>
            <span className="wp-section-hint">opcjonalnie</span>
          </header>
          <FilePicker
            files={files}
            onChange={setFiles}
            disabled={stage.kind !== "idle"}
            variant="public"
          />
        </section>

        {showError("answers") && (
          <div className="wp-submit-error">
            Uzupełnij wymagane pytania zaznaczone gwiazdką.
          </div>
        )}
        {submitError && <div className="wp-submit-error">{submitError}</div>}

        <div className="wp-submit-row">
          <button
            type="submit"
            className="wp-submit-btn"
            disabled={stage.kind !== "idle" || (touched && !canSubmit)}
          >
            {stage.kind === "creating"
              ? "Wysyłanie zapytania…"
              : stage.kind === "waitingFolder"
                ? "Tworzymy folder i wgrywamy pliki…"
                : stage.kind === "uploading"
                  ? `Wysyłanie plików ${stage.done}/${stage.total}…`
                  : "Wyślij zapytanie"}
          </button>
          <span className="wp-section-hint">
            Wysyłając zapytanie akceptujesz przetwarzanie danych w celu
            przygotowania wyceny.
          </span>
        </div>
      </form>
    </main>
  );
}

function QuestionField({
  q,
  answer,
  onChange,
  touched,
}: {
  q: QuestionRow;
  answer: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  touched: boolean;
}) {
  const labelClass = q.isRequired ? "wp-label wp-label-required" : "wp-label";

  if (q.answerType === "boolean") {
    const current =
      answer && "boolean" in answer ? answer.boolean : undefined;
    const missing = q.isRequired && touched && typeof current !== "boolean";
    return (
      <div className="wp-field">
        <span className={labelClass}>{q.text}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="wp-q-bool">
            <input
              type="radio"
              checked={current === true}
              onChange={() => onChange({ boolean: true })}
            />
            <span>Tak</span>
          </label>
          <label className="wp-q-bool">
            <input
              type="radio"
              checked={current === false}
              onChange={() => onChange({ boolean: false })}
            />
            <span>Nie</span>
          </label>
        </div>
        {missing && <span className="wp-error">To pole jest wymagane.</span>}
      </div>
    );
  }

  if (q.answerType === "number") {
    const cur =
      answer && "number" in answer
        ? answer
        : ({} as { number?: number; unit?: string });
    const missing =
      q.isRequired && touched && typeof cur.number !== "number";
    return (
      <div className="wp-field">
        <span className={labelClass}>{q.text}</span>
        <div className="wp-q-num-row">
          <input
            className="wp-input"
            type="number"
            inputMode="decimal"
            step="any"
            value={typeof cur.number === "number" ? cur.number : ""}
            onChange={(e) => {
              const raw = e.target.value;
              const num = raw === "" ? undefined : Number(raw);
              onChange({
                number: Number.isFinite(num) ? (num as number) : undefined,
                unit: cur.unit,
              });
            }}
          />
          {q.units && q.units.length > 0 && (
            <div className="wp-q-units">
              {q.units.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`wp-q-unit${cur.unit === u ? " is-active" : ""}`}
                  onClick={() => onChange({ number: cur.number, unit: u })}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>
        {missing && <span className="wp-error">To pole jest wymagane.</span>}
      </div>
    );
  }

  const text = answer && "text" in answer ? (answer.text ?? "") : "";
  const missing = q.isRequired && touched && !text.trim();
  return (
    <div className="wp-field">
      <span className={labelClass}>{q.text}</span>
      <input
        className="wp-input"
        type="text"
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      {missing && <span className="wp-error">To pole jest wymagane.</span>}
    </div>
  );
}

function ThankYou({
  stage,
}: {
  stage: Extract<SubmitStage, { kind: "done" }>;
}) {
  return (
    <main className="wp-main">
      <div className="wp-thanks">
        <div className="wp-thanks-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="wp-thanks-title">Dziękujemy!</h1>
        <p className="wp-thanks-text">
          Zapytanie zostało zarejestrowane. Odezwiemy się tego samego dnia
          roboczego. Numer Twojej wyceny:
        </p>
        <div className="wp-thanks-code">{stage.code}</div>

        {stage.filesTotal > 0 && (
          <p className="wp-thanks-text">
            Pliki: {stage.filesUploaded} z {stage.filesTotal} wgrane.
          </p>
        )}

        {stage.filesTotal > 0 && !stage.folderReady && (
          <div className="wp-thanks-warning">
            Nie udało się przygotować folderu na pliki w określonym czasie.
            Zapisaliśmy Twoje zapytanie — opiekun skontaktuje się w sprawie
            przesłania załączników.
          </div>
        )}

        {stage.filesTotal > 0 &&
          stage.folderReady &&
          stage.filesUploaded < stage.filesTotal && (
            <div className="wp-thanks-warning">
              Część plików nie została wysłana (
              {stage.filesTotal - stage.filesUploaded} z {stage.filesTotal}).
              Opiekun poprosi o ich przesłanie podczas kontaktu.
            </div>
          )}
      </div>
    </main>
  );
}
