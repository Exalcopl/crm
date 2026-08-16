# Dokumentacja HTTP API (Convex)

Niniejszy dokument opisuje wszystkie punkty końcowe (endpoints) HTTP API wystawione przez system CRM.

Bazowy adres URL zależy od środowiska (np. `https://twoja-domena.convex.site`).

---

## 1. API dla Partnerów Zewnętrznych (Partner API)

Te punkty końcowe służą do integracji z zewnętrznymi systemami partnerów handlowych.
Wymagają uwierzytelnienia za pomocą nagłówka `X-Api-Key`.

### 1.1. Utworzenie zlecenia (`POST /api/partner/orders`)

Tworzy nowe zlecenie o statusie "Nowe" przypisane do Klienta i Typu Projektu skonfigurowanego dla danego Partnera w panelu CRM.
Do ceny netto przesłanej w zapytaniu automatycznie doliczana jest marża partnera.

* **Metoda:** `POST`
* **Adres:** `/api/partner/orders`
* **Nagłówki:**
  - `X-Api-Key`: `pk_live_xxxxxxxxxxxxxxxxxxxxxxxx` (klucz wygenerowany w CRM)
  - `Content-Type`: `application/json`
* **Zapytanie (Request Body):**
  ```json
  {
    "valueNetto": 12500.00
  }
  ```
* **Odpowiedź (Response - 201 Created):**
  ```json
  {
    "success": true,
    "orderId": "pd79ddwdn...",
    "orderNumber": "ZL-260802416",
    "clientName": "Nazwa Klienta Partnera"
  }
  ```

---

### 1.2. Przesłanie pliku do zlecenia (`POST /api/partner/orders/upload-file`)

Przesyła plik (np. plik RW lub Rysunek techniczny) i zapisuje go w podfolderze **„Dokumentacja”** w katalogu SharePoint powiązanym z danym zleceniem.

* **Metoda:** `POST`
* **Adres:** `/api/partner/orders/upload-file`
* **Nagłówki:**
  - `X-Api-Key`: `pk_live_xxxxxxxxxxxxxxxxxxxxxxxx`
  - `Content-Type`: `application/json`
* **Zapytanie (Request Body):**
  ```json
  {
    "orderIdOrNumber": "ZL-260802416", // ID zlecenia w Convex lub numer zlecenia
    "fileType": "RW",                 // "RW" lub "Rysunek"
    "fileName": "rysunek_konstrukcji.dwg",
    "fileBase64": "JVBERi0xLjQKJVRlc3QgUERGIGNvbnRlbnQg..." // Zawartość pliku w Base64
  }
  ```
* **Odpowiedź (Response - 201 Created):**
  ```json
  {
    "success": true,
    "fileId": "01ABCDEF...",          // ID pliku w SharePoint
    "fileName": "Rysunek_rysunek_konstrukcji.dwg",
    "webUrl": "https://..."           // Bezpośredni link do pliku w SharePoint
  }
  ```

---

## 2. Integracje ze Stroną WWW (Lead API & Configurator)

Wspiera interaktywne formularze wycen oraz konfigurator na publicznej stronie internetowej. Uwierzytelnienie odbywa się przy pomocy klucza strony www w nagłówku `Authorization`.

### 2.1. Pobranie struktury konfiguratora (`GET /api/configurator/{slug}`)

Zwraca strukturę opcji konfiguratora dla danego typu produktu (np. pergola, stolarka).

* **Metoda:** `GET`
* **Adres:** `/api/configurator/{slug}` (np. `/api/configurator/pergola`)
* **Odpowiedź (200 OK):** Zwraca pełny obiekt konfiguracji i opcji cenowych.

### 2.2. Pobranie galerii typu projektu (`GET /api/gallery/{typeName}`)

Zwraca zdjęcia i realizacje powiązane z wybranym typem projektu w celu wyświetlenia w konfiguratorze.

* **Metoda:** `GET`
* **Adres:** `/api/gallery/{typeName}`

### 2.3. Utworzenie leada ze strony (`POST /api/lead/{slug}`)

Tworzy nową wycenę w CRM na podstawie formularza kontaktowego ze strony www.

* **Metoda:** `POST`
* **Adres:** `/api/lead/{slug}` (np. `/api/lead/pergola`)
* **Nagłówki:**
  - `Authorization`: `Bearer <website_api_key>`
  - `Content-Type`: `application/json`
* **Zapytanie (Request Body):**
  ```json
  {
    "name": "Jan Kowalski",
    "phone": "+48500600700",
    "email": "jan.kowalski@example.com",
    "description": "Zapytanie o wycenę pergoli wolnostojącej",
    "configuration": { ... } // Szczegóły wybrane w konfiguratorze
  }
  ```
* **Odpowiedź (201 Created):**
  ```json
  {
    "success": true,
    "code": "W-260801",
    "quoteId": "...",
    "uploadToken": "..."
  }
  ```

### 2.4. Sesja wgrywania załączników leada (`POST /api/lead/upload-session`)

Zwraca jednorazowy adres URL do bezpośredniego wgrania plików leada do SharePoint.

* **Metoda:** `POST`
* **Adres:** `/api/lead/upload-session`

---

## 3. Webhooki SharePoint (`/api/sharepoint/webhook`)

Punkty końcowe wywoływane przez Microsoft Graph w celu synchronizacji plików w tle.

* **GET /api/sharepoint/webhook**: Służy do weryfikacji subskrypcji webhooka przez Microsoft (odpowiada tokenem `validationToken`).
* **POST /api/sharepoint/webhook**: Odbiera powiadomienia o modyfikacji plików w folderach SharePoint i planuje ich przetwarzanie (np. OCR, detekcja załączników).

---

## 4. API Autoryzacji (`/api/auth/*`)

Punkty końcowe obsługiwane automatycznie przez bibliotekę `@convex-dev/auth` na potrzeby logowania, tokenów JWT oraz autoryzacji OAuth.
