# Logika tworzenia folderów SharePoint — Klient/Wycena

## Przepływ tworzenia folderów

### 1. Trigger — utworzenie wyceny

Gdy tworzysz wycenę w panelu lub przez formularz publiczny (`/wycena`), scheduler uruchamia asynchronicznie funkcję tworzenia folderu:

```
quotes.create() / quotes.createPublic()
  ↓
  ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, { quoteId })
```

---

## 2. Struktura folderów

```
SharePoint: alcopl.sharepoint.com/Klienci/
│
└── {client_folder_name}              ← Parent folder (jeden na klienta)
    ├── metadata: itemId, driveId, webUrl
    └── {quote_folder_name}           ← Subfolder (jeden na wycenę)
        └── metadata: itemId, driveId, webUrl
```

**Nazwy folderów są sanitizowane**:
- Znaki specjalne `/:*?"<>|#%` → `_`
- Spacje i podwójne underscores → skracane
- Max 200 znaków
- Fallback: `"klient"` jeśli nazwa pusta

---

## 3. Logika szczegółowa w `createFolderForQuote`

### Input
```
quote:
  - contact.name: "Kowalski"
  - code: "WC-2600730"
  - _creationTime: 1718000000000
  - clientId: ...
```

### Kroki

#### 1️⃣ **Auth do MS Graph**
```
getGraphToken(tenantId, clientId, clientSecret)
  → access_token (ważny 1h)
```

#### 2️⃣ **Utwórz / sprawdź folder klienta**
```
ensureFolder(
  token,
  driveId = "MS_GRAPH_DRIVE_ID",
  parentPath = "Klienci",
  folderName = sanitizeFolderName("Kowalski")
)

Result: {
  id: "b!...",           # itemId
  webUrl: "https://..."  # link do folderu
}

Zapisz do client.sharepointFolder:
{
  itemId,
  driveId,
  webUrl,
  status: "created",
  attempts: 1,
  lastTriedAt: Date.now()
}
```

#### 3️⃣ **Utwórz subfolder wyceny**
```
quoteFolderName = "{code}_{date}_{sanitized_name}"
  = "WC-2600730_2026-06-10_Kowalski"

ensureFolder(
  token,
  driveId,
  parentPath = "Klienci/Kowalski",  # ← ścieżka względna
  folderName = quoteFolderName
)

Result: {
  id: "b!...",
  webUrl: "https://..."
}

Zapisz do quote.sharepoint:
{
  parentFolderItemId: "{client_folder_id}",
  subfolderItemId: "{quote_folder_id}",
  driveId,
  webUrl,
  status: "created",
  attempts: 1,
  lastTriedAt: Date.now()
}
```

---

## 4. Obsługa błędów

### Retry logic
- **Max 3 próby** (MAX_ATTEMPTS = 3)
- **Backoff**: 500ms → 1500ms → 4500ms
- Każda próba loguje się do konsoli

### Statusy
| Status | Znaczenie |
|--------|-----------|
| `pending` | Oczekuje na tworzenie (początkowy) |
| `created` | ✅ Folder istnieje, można uploadować |
| `failed` | ❌ 3 próby się nie powiodły, zapisany error |

### Jeśli się nie uda
```
quote.sharepoint = {
  status: "failed",
  error: "Graph create folder failed 403: Forbidden",
  attempts: 3,
  webUrl: "",
  driveId: "",
  lastTriedAt: Date.now()
}
```

Przycisk "Spróbuj ponownie" w UI uruchamia:
```
quotes.retrySharepoint(quoteId)
  → scheduler.runAfter(0, createFolderForQuote, { quoteId })
```

---

## 5. Integracja z upload'em plików

### Gdy folder jest `"created"`:

#### 📤 Upload pliku do wyceny
```
sharepoint.createUploadSession({ quoteId, fileName })
  → { uploadUrl }  # Session URL do upload'u (resumable)
```

#### 📋 Listowanie plików w wycenie
```
sharepoint.listQuoteFiles({ quoteId })
  → [{ id, name, size, lastModifiedDateTime, mimeType }]
```

#### 📥 Pobranie pliku do podglądu
```
sharepoint.getFileForPreview({ quoteId, fileId })
  → { base64, contentType }
```

### Ograniczenia
- Max rozmiar: **20 MB** (PUBLIC_MAX_FILE_BYTES)
- Dozwolone typy: `png, jpg, jpeg, gif, webp, pdf, dwg, dxf`

---

## 6. Zmienne środowiskowe (Convex env)

```bash
# SharePoint / Microsoft Graph
MS_TENANT_ID              = "10847308-..."
MS_CLIENT_ID              = "8681b48b-..."
MS_CLIENT_SECRET          = "rbF8Q~..."
MS_GRAPH_DRIVE_ID         = "b!DMQ3Y..."

# Konfiguracja folderów
SHAREPOINT_PARENT_PATH    = "Klienci"  (default)

# Next.js
NEXT_PUBLIC_CONVEX_URL    = "http://127.0.0.1:3210"
SEED_ADMIN_EMAIL          = "admin@exalco.pl"
SEED_ADMIN_PASSWORD       = "Admin12345!"
```

---

## 7. Flow — od A do Z

```
👤 User: Tworzy wycenę
  ↓
🔧 Quote created in DB
  ↓
⏱ Scheduler (runAfter 0ms)
  ↓
🔐 Get MS Graph token
  ↓
📁 Ensure client folder
  ├─ Check if exists (GET)
  ├─ If not → Create (POST)
  └─ Store: client.sharepointFolder
  ↓
📁 Ensure quote subfolder
  ├─ Check if exists (GET)
  ├─ If not → Create (POST)
  └─ Store: quote.sharepoint { status: "created" }
  ↓
✅ Done! Status: "created"
   User can now upload files

❌ On error (retry 3x):
   quote.sharepoint { status: "failed", error: "..." }
   → User sees red indicator + "Spróbuj ponownie"
```

---

## 8. Cascading delete

Gdy usuwasz klienta → usuwane są:
1. Wszystkie subfolders wycen (na SharePoint)
2. Parent folder klienta (na SharePoint)
3. Wszystkie wyceny z DB
4. Wszystkie notatki/zadania do każdej wyceny

```
deleteClientCascade(clientId)
  ├─ For each quote in client
  │  └─ Delete quote subfolder
  ├─ Delete client folder
  └─ Cascade delete all related records in DB
```

---

## Linkowanie do kodu

- **Główna logika**: `/convex/sharepoint.ts:649-741` (createFolderForQuote)
- **Tworzenie wyceny**: `/convex/quotes.ts:156-203` (create)
- **Formularz publiczny**: `/convex/quotes.ts:232-408` (createPublic)
- **Graph API helper**: `/convex/sharepoint.ts:61-129` (ensureFolder)
- **Sanitizacja nazw**: `/convex/sharepoint.ts:11-31` (sanitizeFolderName, buildClientFolderName, buildQuoteSubfolderName)
