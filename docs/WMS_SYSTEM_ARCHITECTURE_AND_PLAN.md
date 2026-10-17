# Exalco WMS – Dokumentacja i Plan Implementacji (MVP: profile aluminiowe)
**Wersja:** 2.0 – zastępuje v1.0/v1.1 (zawężony zakres po decyzjach właściciela)  
**Data:** Październik 2026  
**Status:** tylko dokumentacja i plan – brak implementacji

---

## 0. Decyzje projektowe (potwierdzone)

| # | Decyzja | Konsekwencja |
|---|---|---|
| 1 | Brak zewnętrznego ERP. WMS to dodatkowy moduł Exalco CRM. | **Exalco CRM jest źródłem prawdy** dla dokumentów magazynowych (PZ/RW/MM…). Wspólna baza Convex, wspólne logowanie i RBAC. Brak integracji wychodzącej do ERP. |
| 2 | Listy cięć (LogiKal) – **poza zakresem**. | Brak parsera, brak rezerwacji pod listy cięć, brak priorytetyzacji spadów przy optymalizacji. |
| 3 | Terminale i drukarki – **następna iteracja**. | Brak etykietowania, Brother RJ‑4250WB, skanerów, trybu offline w MVP. Model danych przewiduje kody (SSCC/lot) na przyszłość. |
| 4 | Operujemy wyłącznie na **profilach aluminiowych**, bez cięć. Produkcja (cięcie, spady, WIP, stojaki) – osobny, późniejszy moduł. | Brak półproduktów, spadów powstających z cięcia, stojaków, pakietów szybowych, okuć, Kanban. |
| 5 | WMS korzysta z **istniejącej tabeli `materials`**. | Brak własnego słownika indeksów. Cechy magazynowe trzymane w tabeli dodatkowej wskazującej `materialId` (patrz §4), aby nie zmieniać semantyki cennika. |

> [!NOTE]
> Odpowiedź „TAK” na pytanie „materials czy własny słownik” zinterpretowałem jako „używamy `materials`”. Jeśli chodziło o co innego – do korekty.

---

## 1. Zakres MVP

**W zakresie**
1. Przełącznik **CRM | WMS** obok logotypu „Exalco CRM” w titlebarze; WMS jako osobny segment `/admin/wms/*` z własnymi zakładkami.
2. Kartoteka profili (na bazie `materials`, kategoria `PROFILE`) z atrybutami magazynowymi.
3. Lokalizacje magazynowe (regały wspornikowe, bufor, kwarantanna).
4. Ewidencja partii/dłużyc: długość, kolor (RAL/anoda/surowy), partia/wytop, atest 3.1 (plik), SSCC opcjonalnie.
5. Dokumenty magazynowe: **PZ** (przyjęcie, dwuetapowa kontrola jakości), **RW** (wydanie na produkcję – całych sztang/wiązek, bez cięcia), **MM** (przesunięcie między lokalizacjami), **korekta/inwentaryzacja**.
6. Kwarantanna jakościowa (blokada wydania), rejestracja uszkodzeń powłoki przy PZ.
7. Konfigurowalne reguły ewidencji (administrator decyduje o ziarnistości śledzenia).
8. Jednostki wielokrotne: sztuki ↔ mb ↔ kg.
9. Uprawnienia WMS w istniejącym RBAC.
10. Dziennik ruchów (audyt) i widoki stanów.

**Poza zakresem (kolejne iteracje)**
- Listy cięć / LogiKal / ReynaPro, rezerwacja pod cięcie.
- Rejestracja spadów powstających na pile, priorytetyzacja spadów, etykieta spadu.
- WIP, CNC, zagniatarka, stojaki SSCC, wysyłka.
- Pakiety szybowe, okucia, Kanban/backflushing.
- Terminale, skanery, drukarki Brother, offline‑first, Touch UI.
- Algorytmy ABC/XYZ (w MVP tylko ręczny wybór lokalizacji; ew. podpowiedź wg wagi).

> [!TIP]
> Spady wprowadzone ręcznie (np. istniejące resztki przy inwentaryzacji) można w MVP traktować jako zwykłe partie z krótką długością (`kind = REMNANT`). Pełny cykl życia spadu wchodzi z modułem Produkcji.

---

## 2. Przełącznik modułów i nawigacja

Miejsce zmiany: [app/admin/layout.tsx](file:///Users/wojtekzapora/Documents/venturebox/Exalco/crm/app/admin/layout.tsx), titlebar (`brand` ok. linii 153). Obok logotypu – przełącznik **CRM | WMS** (segmentowy lub dropdown). Aktywny moduł wynika z `pathname` (`/admin/wms*` = WMS).

```
[ E ] Exalco  [ CRM | WMS ]   [ Wyszukaj… ⌘K ]                 (🔔) [Użytkownik] [⎋]
-------------------------------------------------------------------------------------
WMS: [Przegląd] [Stany] [Profile] [Lokalizacje] [PZ] [RW] [MM] [Inwentaryzacja] [Kwarantanna] [Ustawienia]
```

- Zakładki WMS zastępują `TABS` CRM, gdy aktywny jest WMS; ten sam `PermissionsProvider`, sesja i wyszukiwarka.
- Przełącznik widoczny tylko dla użytkowników z uprawnieniem `wms:read`.
- Ostatni moduł zapamiętywany w `localStorage` (ewentualnie w profilu użytkownika – decyzja przy implementacji; zmiana profilu = zmiana schematu = test).
- Trasy: `/admin/wms`, `/stany`, `/profile`, `/lokalizacje`, `/pz`, `/pz/[id]`, `/rw`, `/mm`, `/inwentaryzacja`, `/kwarantanna`, `/ustawienia`.

> [!WARNING]
> `AGENTS.md`: ta wersja Next.js ma zmiany łamiące. Przed kodowaniem (layout, routing, komponenty klienckie) przeczytać odpowiednie przewodniki w `node_modules/next/dist/docs/`.

---

## 3. Uprawnienia (RBAC)

Obecnie: `RESOURCES = ["wyceny","klienci","users","roles"]` w `convex/permissions.ts`, akcje `read/create/update/delete`, zakresy `own/team/all`, seed w `convex/seed.ts`.

Plan:
- Dodać zasoby: `wms` (podgląd stanów), `wms_documents` (PZ/RW/MM), `wms_settings` (reguły ewidencji, lokalizacje, słowniki), `wms_inventory` (inwentaryzacja/korekty), `wms_quality` (zwalnianie kwarantanny).
- Zaktualizować seed i UI ról (`app/admin/roles`).
- Przykładowe role: *Magazynier* (wms read; documents create), *Kierownik magazynu* (+ inventory, quality), *Administrator WMS* (+ settings).
- Backend: każda mutacja WMS sprawdza uprawnienie po stronie Convex (nie tylko ukrycie w UI).

---

## 4. Model danych (Convex) – propozycja

Zasada: **stan = suma ruchów**. Ruchy są niezmienne (append‑only); partie trzymają stan bieżący jako zdenormalizowany odczyt, aktualizowany wyłącznie w mutacjach dokumentów.

### 4.1. `wms_material_profiles` – cechy magazynowe indeksu z `materials`
- `materialId: Id<"materials">` (unikalne), `isTracked: boolean`
- `systemSeries?: string`, `kgPerMb?: number`, `standardLengthMm?: number`
- `trackingMode: "STRICT" | "QUANTITY" | "NONE"` (domyślny dla indeksu)
- `requiresCertificate: boolean`, `requiresColor: boolean`
- `minUsefulRemnantMm?: number` (zarezerwowane pod moduł Produkcji)
- Indeks: `by_material`.

### 4.2. `wms_tracking_rules` – konfigurowalna ziarnistość (wymaganie §1 specyfikacji)
- `scope: { category?: string, materialId?: Id<"materials">, zone?: ZoneType }`
- `trackingMode`, `requiredAttributes: string[]` (np. `length`, `color`, `lot`, `certificate`)
- `enforceCycleCount: boolean`
- `priority: number` – reguła bardziej szczegółowa (materiał > kategoria; strefa) wygrywa.
- Funkcja rozstrzygająca `resolveTrackingRule(materialId, zone)` używana w walidacji dokumentów.

### 4.3. `wms_locations`
- `code` (unikalny), `name`, `zone: "MAGAZYN_GLOWNY" | "BUFOR_PRODUKCYJNY" | "KWARANTANNA" | "STREFA_SPADOW"`, `type: "CANTILEVER" | "SHELF" | "FLOOR"`
- `maxWeightKg?`, `maxLengthMm?`, `isActive`
- Indeksy: `by_code`, `by_zone`.
- Uwaga: `BUFOR_PRODUKCYJNY` pełni rolę „przejęcia własności” (status zapasu `W_TOKU`); w MVP sam bufor bez maszyn.

### 4.4. `wms_lots` – partie/dłużyce
- `materialId`, `kind: "BAR_BUNDLE" | "BAR" | "REMNANT"`
- `lengthMm`, `colorCode?`, `surfaceType?: "MILL" | "RAL" | "ANODA" | "BICOLOR"`
- `heatNumber?` (partia/wytop), `certificateStorageId?` (atest 3.1, Convex storage), `ssccCode?`
- `quantityPieces`, `locationId`, `status: "AVAILABLE" | "QUALITY_HOLD" | "ISSUED"`
- `receivedByDocumentId`, `createdAt`, `updatedAt`
- Indeksy: `by_material`, `by_location`, `by_status`, `by_sscc`.
- Wyliczane: `totalMb = quantityPieces × lengthMm / 1000`, `weightKg = totalMb × kgPerMb`.

### 4.5. `wms_documents` i `wms_document_lines`
- Dokument: `type: "PZ" | "RW" | "MM" | "KOREKTA"`, `number` (np. `PZ/2026/0001`, numeracja per typ i rok), `status: "DRAFT" | "ZATWIERDZONY" | "ANULOWANY"`, `supplier?`, `externalDocNumber?` (WZ/list dostawcy), `orderId?: Id<"orders">` (RW pod zlecenie – tylko powiązanie informacyjne), `notes`, `createdBy`, `approvedBy?`, timestampy.
- Linia: `lotId?`, `materialId`, `quantityPieces`, `lengthMm`, `fromLocationId?`, `toLocationId?`, `damage?: { description, positionMm?, disposition: "ACCEPT" | "QUALITY_HOLD" | "REJECT" }`.
- Zatwierdzenie dokumentu = **jedna transakcja Convex**: walidacja reguł → zapis ruchów → aktualizacja partii.

### 4.6. `wms_movements` (dziennik, append‑only)
- `documentId`, `lineId`, `lotId`, `type`, `fromLocationId?`, `toLocationId?`, `quantityPieces`, `lengthMm`, `operatorId`, `idempotencyKey`, `createdAt`
- Indeksy: `by_lot`, `by_document`, `by_idempotency`.

### 4.7. Inwentaryzacja
- `wms_inventory_sessions` (zakres: lokalizacja/strefa, status, otwarcie/zamknięcie) i `wms_inventory_counts` (lot/lokalizacja, policzone vs systemowe, różnica). Zamknięcie generuje dokument `KOREKTA`.

### 4.8. Związek z istniejącymi tabelami
- `materials` – bez zmian; kategoria `PROFILE` (inne kategorie – akcesoria/okucia – w MVP nieśledzone).
- `orders` – opcjonalne powiązanie RW (informacyjne). **Nie zmieniamy `orders.status`** w MVP; ewentualne mapowanie (kompletacja/produkcja) dopiero z modułem Produkcji.
- `users`, `permissions` – wspólne.

---

## 5. Procesy MVP

### 5.1. PZ – przyjęcie dwuetapowe
1. **Etap 1 (ilościowy):** utworzenie dokumentu `DRAFT`: dostawca, nr dokumentu dostawcy, liczba wiązek/koszy.
2. **Etap 2 (rozładunek i jakość):** dla każdej linii – materiał, długość, kolor, partia/wytop, atest 3.1 (upload), lokalizacja docelowa; rejestracja uszkodzeń powłoki (opis, pozycja w mm, decyzja: akceptuj / kwarantanna / odrzuć).
3. Zatwierdzenie: ruchy `PZ`, utworzenie `wms_lots` (status `AVAILABLE` lub `QUALITY_HOLD`).
4. Walidacja wg `resolveTrackingRule` (np. brak atestu przy `requiresCertificate` blokuje zatwierdzenie).

### 5.2. Składowanie
- Wybór lokalizacji ręcznie; podpowiedź ostrzegająca przy przekroczeniu `maxWeightKg`/`maxLengthMm`.

### 5.3. RW – wydanie na produkcję (bez cięć)
- Wydanie całej partii/liczby sztang z lokalizacji głównej do `BUFOR_PRODUKCYJNY`; status zapasu przechodzi na „w toku”. Blokada, gdy lot ma status `QUALITY_HOLD`. Opcjonalne powiązanie z `orders`.
- Dalsze rozliczanie (zużycie, spad, powrót) – moduł Produkcji.

### 5.4. MM – przesunięcie
- Zmiana lokalizacji lotu (całości lub części sztuk – dzieli lot na dwa rekordy).

### 5.5. Kwarantanna jakościowa
- Lot w `QUALITY_HOLD` (np. po lakierni lub z uszkodzeniem) nie może być wydany; zwolnienie wymaga uprawnienia `wms_quality` i wpisu w dzienniku (kto, kiedy, uwagi).

### 5.6. Inwentaryzacja i korekty
- Sesja zliczania per lokalizacja; różnice zatwierdza uprawniona osoba; efekt: dokument `KOREKTA` + ruchy.

### 5.7. Raporty podstawowe
- Stan wg indeksu/koloru/lokalizacji w szt., mb, kg; historia ruchów lotu (traceability: PZ → atest → RW); lista lotów w kwarantannie.

---

## 6. Wymagania poza funkcjonalne
- **Spójność:** zatwierdzanie dokumentów atomowe (transakcja Convex); `idempotencyKey` w ruchach, by powtórzenie żądania nie dublowało stanu.
- **Audyt:** brak usuwania ruchów; anulowanie dokumentu = ruch odwrotny.
- **Zgodność wizualna:** styl `fluent.css` (jak reszta panelu), responsywność tablet/desktop; Touch UI i terminale – kolejna iteracja.
- **Wydajność:** indeksy wg §4; widoki stanów oparte o zdenormalizowane `wms_lots`.

---

## 7. Plan implementacji (kolejność faz, bez szacunków czasu)

**Faza 0 – Przygotowanie**
- Lektura `node_modules/next/dist/docs/` (routing, layouts); przegląd `materials` (kategorie, jednostki, aktualne dane `PROFILE`).

**Faza 1 – Fundament**
- Schemat: `wms_material_profiles`, `wms_tracking_rules`, `wms_locations`.
- RBAC: nowe zasoby, seed, role.
- `ModuleSwitcher` w `app/admin/layout.tsx`; `app/admin/wms/layout.tsx` z zakładkami; puste strony.
- Strony: Profile (nakładka na `materials`), Lokalizacje, Ustawienia → Reguły ewidencji.
- **Test:** zapis/odczyt profili, reguł (rozstrzyganie priorytetów) i lokalizacji.

**Faza 2 – Partie i PZ**
- Schemat: `wms_lots`, `wms_documents`, `wms_document_lines`, `wms_movements`.
- Mutacje: tworzenie PZ (draft), edycja linii, upload atestu, zatwierdzenie (atomowe), numeracja.
- UI: lista/szczegóły PZ, formularz dwuetapowy, rejestr uszkodzeń.
- **Test:** zatwierdzenie PZ tworzy lot + ruch; walidacja brakującego atestu; idempotencja.

**Faza 3 – Wydania, przesunięcia, kwarantanna**
- RW, MM (z dzieleniem lotu), kwarantanna i zwalnianie.
- Widok Stany (filtry, szt/mb/kg), historia lotu.
- **Test:** RW blokowany dla `QUALITY_HOLD`; MM dzieli lot i zachowuje sumy; stan = suma ruchów.

**Faza 4 – Inwentaryzacja i raporty**
- Sesje zliczania, dokument KOREKTA, raporty podstawowe.
- **Test:** różnica inwentaryzacyjna → korekta zgodna ze stanem.

**Kolejne iteracje (poza tym dokumentem):** terminale/skanery i druk etykiet → moduł Produkcji (listy cięć, spady, WIP, stojaki) → pozostałe kategorie (szyby, okucia, Kanban).

---

## 8. Strategia testów (wymóg `AGENTS.md`)
- Każda faza zmieniająca bazę ma skrypt testowy w stylu istniejących `scripts/test-*.ts` / `verify-*.mjs`, uruchamiany przed uznaniem fazy za gotową; test obejmuje zapis i odczyt oraz reguły biznesowe z danej fazy.
- Testy nie dotykają produkcji; dane testowe sprzątane po teście.
- **Brak wypychania na produkcję** (`git push origin main` / `npx convex deploy`) bez wyraźnego polecenia.

---

## 9. Ryzyka i otwarte kwestie
1. **Dane w `materials`:** czy profile są tam poprawnie skategoryzowane (`PROFILE`) i z jednostką mb? Do weryfikacji w Fazie 0; w razie braków – import/uzupełnienie.
2. **Rola `orders` przy RW:** w MVP tylko referencja informacyjna – potwierdzić, czy wystarczy.
3. **WZ dla profili** sprzedawanych bezpośrednio klientom – w MVP pominięty; do decyzji, czy potrzebny.
4. **Przełączanie modułu per rola:** czy magazynierzy mają trafiać domyślnie do WMS (preferencja zapisywana w profilu = zmiana schematu `users`)?
5. **Interpretacja odpowiedzi „TAK”** dot. `materials` (patrz §0).
