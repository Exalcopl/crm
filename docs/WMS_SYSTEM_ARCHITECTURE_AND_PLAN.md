# Exalco WMS – Dokumentacja i Plan Implementacji
**Wersja:** 3.0 – rozszerzenie o konfigurowalne kategorie produktów, obiekty magazynowe i dynamiczne pola  
**Data:** Październik 2026  
**Status:** Zaimplementowano w MVP

---

## 0. Decyzje projektowe (potwierdzone)

| # | Decyzja | Konsekwencja |
|---|---|---|
| 1 | Brak zewnętrznego ERP. WMS to dodatkowy moduł Exalco CRM. | **Exalco CRM jest źródłem prawdy** dla dokumentów magazynowych (PZ/RW). Wspólna baza Convex, wspólne logowanie. Brak integracji wychodzącej do ERP. |
| 2 | Listy cięć (LogiKal) – **poza zakresem**. | Brak parsera, brak rezerwacji pod listy cięć, brak priorytetyzacji spadów przy optymalizacji. |
| 3 | Terminale i drukarki – **następna iteracja**. | Model danych przewiduje kody (SSCC/lot) na przyszłość. |
| 4 | **Magazyn wielobranżowy** (nie tylko profile). Konfigurowalne kategorie produktów (`Kategoria -> Nazwa obiektu magazynowego`). | Możliwość ewidencji profili (sztangi), szyb zespolonych (pakiety szybowe), okuć (komplety), uszczelek (rolki), blach (arkusze), akcesoriów (paczki). Dynamiczne pola wg konfiguracji kategorii. |
| 5 | Uproszczenie procesów w MVP. | Usunięto osobną Kwarantannę i MM (przesunięcia międzymagazynowe). Pozostają PZ (przyjęcie) oraz RW (wydanie do bufora produkcyjnego). Lokalizacje uproszczone do samej nazwy. |
| 6 | WMS korzysta z **istniejącej tabeli `materials`**. | Brak dublowania indeksów. Cechy magazynowe i przypisana kategoria WMS trzymane w bazie (`wmsCategoryId`). |

---

## 1. Zakres MVP

**W zakresie**
1. Przełącznik **CRM | WMS** obok logotypu „Exalco CRM” w titlebarze; WMS jako osobny segment `/admin/wms/*` z własnymi zakładkami.
2. **Kategorie i obiekty magazynowe** (`/admin/wms/kategorie`):
   - Konfiguracja kategorii towarów (Profile aluminiowe, Szyby zespolone, Okucia i zamki, Uszczelki, Blachy i panele, Drobne akcesoria).
   - Definicja nazwy jednostki magazynowej (Sztanga/Wiązka, Pakiet szybowy, Komplet okuć, Rolka, Arkusz, Opakowanie).
   - Dynamiczne przełączniki pól dla danej kategorii: długość, szerokość, wysokość, grubość, masa, kolor, powłoka, partia/wytop, atest, SSCC oraz pola niestandardowe (np. Producent, Strona L/P, Budowa pakietu).
3. Dokumenty magazynowe: **PZ** (przyjęcie z dynamicznym formularzem pól wg kategorii) oraz **RW** (wydanie do bufora produkcyjnego).
4. Lokalizacje magazynowe (wpisywanie samej nazwy lokalizacji/regału).
5. Ewidencja partii/stanów wielowymiarowych (długość, szerokość, wysokość, grubość, masa, cechy i atrybuty niestandardowe).
6. Pełna identyfikowalność: stan = suma ruchów, automatyczne testy weryfikacyjne w Convex.

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
- Przełącznik widoczny dla każdego zalogowanego użytkownika.
- Ostatni moduł zapamiętywany tylko w `localStorage` (bez zmian w tabeli `users`).
- Trasy: `/admin/wms`, `/stany`, `/profile`, `/lokalizacje`, `/pz`, `/pz/[id]`, `/rw`, `/mm`, `/inwentaryzacja`, `/kwarantanna`, `/ustawienia`.

> [!WARNING]
> `AGENTS.md`: ta wersja Next.js ma zmiany łamiące. Przed kodowaniem (layout, routing, komponenty klienckie) przeczytać odpowiednie przewodniki w `node_modules/next/dist/docs/`.

---

## 3. Dostęp i uprawnienia

Obecnie: `RESOURCES = ["wyceny","klienci","users","roles"]` w `convex/permissions.ts`, akcje `read/create/update/delete`, zakresy `own/team/all`, seed w `convex/seed.ts`.

Decyzja MVP: **brak podziału na użytkowników magazynowych i brak nowych uprawnień WMS.** Każdy zalogowany użytkownik systemu ma pełny dostęp do WMS. Nie zmieniamy `RESOURCES` ani seeda. Backend (mutacje i zapytania Convex) wymaga jednak zalogowanej sesji, a każdy ruch zapisuje `operatorId`, więc audyt „kto zrobił” pozostaje.

Później (po testach MVP): ewentualne zasoby `wms*` i role w istniejącym RBAC (`convex/permissions.ts`, `convex/seed.ts`, `app/admin/roles`).

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
- Dokument: `type: "PZ" | "RW" | "MM" | "KOREKTA"`, `number` (np. `PZ/2026/0001`, numeracja per typ i rok), `status: "DRAFT" | "ZATWIERDZONY" | "ANULOWANY"`, `supplier?`, `externalDocNumber?` (nr listu/dokumentu dostawcy), `notes`, `createdBy`, `approvedBy?`, timestampy.
- Linia: `lotId?`, `materialId`, `quantityPieces`, `lengthMm`, `fromLocationId?`, `toLocationId?`, `damage?: { description, positionMm?, disposition: "ACCEPT" | "QUALITY_HOLD" | "REJECT" }`.
- Zatwierdzenie dokumentu = **jedna transakcja Convex**: walidacja reguł → zapis ruchów → aktualizacja partii.

### 4.6. `wms_movements` (dziennik, append‑only)
- `documentId`, `lineId`, `lotId`, `type`, `fromLocationId?`, `toLocationId?`, `quantityPieces`, `lengthMm`, `operatorId`, `idempotencyKey`, `createdAt`
- Indeksy: `by_lot`, `by_document`, `by_idempotency`.

### 4.7. Inwentaryzacja
- `wms_inventory_sessions` (zakres: lokalizacja/strefa, status, otwarcie/zamknięcie) i `wms_inventory_counts` (lot/lokalizacja, policzone vs systemowe, różnica). Zamknięcie generuje dokument `KOREKTA`.

### 4.8. Związek z istniejącymi tabelami
- `materials` – bez zmian; kategoria `PROFILE` (inne kategorie – akcesoria/okucia – w MVP nieśledzone).
- `orders` – **brak powiązania w MVP** (ani relacji, ani zmian statusów). Powiązanie z zleceniami dopiero z modułem Produkcji.
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
- Wydanie całej partii/liczby sztang z lokalizacji głównej do `BUFOR_PRODUKCYJNY`; status zapasu przechodzi na „w toku”. Blokada, gdy lot ma status `QUALITY_HOLD`. Bez powiązania ze zleceniem; opcjonalnie wolnotekstowe pole „cel/odbiorca”.
- Dalsze rozliczanie (zużycie, spad, powrót) – moduł Produkcji.

### 5.4. MM – przesunięcie
- Zmiana lokalizacji lotu (całości lub części sztuk – dzieli lot na dwa rekordy).

### 5.5. Kwarantanna jakościowa
- Lot w `QUALITY_HOLD` (np. po lakierni lub z uszkodzeniem) nie może być wydany; zwolnienie dostępne dla każdego użytkownika WMS, z obowiązkowym wpisem w dzienniku (kto, kiedy, uwagi).

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
- Bez zmian w RBAC: dostęp do WMS dla każdego zalogowanego użytkownika (wymagana tylko sesja).
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
2. **Uprawnienia po MVP:** w MVP każdy zalogowany użytkownik ma pełny dostęp do WMS. Zasoby i role WMS (np. magazynier, kierownik) do rozważenia po testach MVP.
