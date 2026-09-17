import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type ParsedRwItem = {
  lp: number;
  element: string;
  quantity: number;
  unit: string;
  priceUnit: number;
  priceTotal: number;
  description?: string;
  materialId?: string;
  matchScore?: number;
};

type ParsedRwSection = {
  id: string;
  name: string;
  items: ParsedRwItem[];
  sectionTotal: number;
};

// Helper: Pobranie pliku z SharePoint Graph API
async function fetchFileFromSharePoint(ctx: any, orderId: Id<"orders">, fileItemId: string): Promise<{ base64: string; mimeType: string }> {
  const order = await ctx.runQuery(api.orders.get, { id: orderId });
  const sp = order?.sharepoint;
  if (!sp?.driveId) throw new Error("Zlecenie nie posiada podłączonego katalogu SharePoint.");

  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Brak konfiguracji SharePoint w środowisku serwera.");
  }

  // Pobierz token Microsoft Graph API
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!tokenRes.ok) throw new Error("Błąd autoryzacji Microsoft Graph API.");
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  const fileRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${fileItemId}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!fileRes.ok) throw new Error(`Nie udało się pobrać pliku z SharePoint (kod ${fileRes.status}).`);

  const buffer = await fileRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = fileRes.headers.get("content-type") || "application/pdf";
  return { base64, mimeType: contentType };
}

// Generowanie symulacji (Mock OCR) na podstawie prawdziwej bazy materiałów w CRM
async function generateMockRwData(ctx: any, fileName: string): Promise<ParsedRwSection[]> {
  const materialsList = (await ctx.runQuery(api.materials.list, {})) ?? [];

  function findMat(cat: string, defaultName: string, defaultPrice: number, defaultUnit: string) {
    const matched = materialsList.find((m: any) => m.category === cat || m.name.toLowerCase().includes(defaultName.toLowerCase().split(" ")[0]));
    if (matched) {
      return {
        element: matched.name,
        priceUnit: matched.priceUnit,
        unit: matched.unit,
        materialId: matched._id,
        matchScore: 0.95,
      };
    }
    return {
      element: defaultName,
      priceUnit: defaultPrice,
      unit: defaultUnit,
      materialId: undefined,
      matchScore: 0,
    };
  }

  const p1 = findMat("PROFILE", "Profil PVC 70mm biały", 28.50, "mb.");
  const p2 = findMat("PROFILE", "Profil słupka T 70mm", 31.00, "mb.");
  const p3 = findMat("PROFILE_DODATKOWE", "Pręt zbrojeniowy 40x20", 8.50, "mb.");

  const a1 = findMat("AKCESORIA", "Uszczelka obwodowa EPDM", 1.20, "mb.");
  const a2 = findMat("AKCESORIA", "Kotwa montażowa L100", 1.25, "szt.");
  const a3 = findMat("AKCESORIA", "Zaślepka narożna", 0.40, "szt.");

  const o1 = findMat("OKUCIA", "Klamka okienna standard", 18.00, "szt.");
  const o2 = findMat("OKUCIA", "Zawias 3D regulowany", 14.50, "szt.");

  const w1 = findMat("WYPELNIENIA", "Szyba zespolona 4/16/4 argon", 88.00, "m²");

  const sections: ParsedRwSection[] = [
    {
      id: "profile",
      name: "PROFILE",
      items: [
        { lp: 1, element: p1.element, quantity: 42.80, unit: p1.unit, priceUnit: p1.priceUnit, priceTotal: parseFloat((42.80 * p1.priceUnit).toFixed(2)), description: "Rama i skrzydło", materialId: p1.materialId, matchScore: p1.matchScore },
        { lp: 2, element: p2.element, quantity: 8.40, unit: p2.unit, priceUnit: p2.priceUnit, priceTotal: parseFloat((8.40 * p2.priceUnit).toFixed(2)), description: "Słupek pośredni", materialId: p2.materialId, matchScore: p2.matchScore },
        { lp: 3, element: p3.element, quantity: 38.20, unit: p3.unit, priceUnit: p3.priceUnit, priceTotal: parseFloat((38.20 * p3.priceUnit).toFixed(2)), description: "Zbrojenie stalowe", materialId: p3.materialId, matchScore: p3.matchScore },
      ],
      sectionTotal: parseFloat(((42.80 * p1.priceUnit) + (8.40 * p2.priceUnit) + (38.20 * p3.priceUnit)).toFixed(2)),
    },
    {
      id: "akcesoria",
      name: "AKCESORIA & USZCZELKI",
      items: [
        { lp: 4, element: a1.element, quantity: 86.40, unit: a1.unit, priceUnit: a1.priceUnit, priceTotal: parseFloat((86.40 * a1.priceUnit).toFixed(2)), description: "", materialId: a1.materialId, matchScore: a1.matchScore },
        { lp: 5, element: a2.element, quantity: 30, unit: a2.unit, priceUnit: a2.priceUnit, priceTotal: parseFloat((30 * a2.priceUnit).toFixed(2)), description: "Do ramy", materialId: a2.materialId, matchScore: a2.matchScore },
        { lp: 6, element: a3.element, quantity: 24, unit: a3.unit, priceUnit: a3.priceUnit, priceTotal: parseFloat((24 * a3.priceUnit).toFixed(2)), description: "", materialId: a3.materialId, matchScore: a3.matchScore },
      ],
      sectionTotal: parseFloat(((86.40 * a1.priceUnit) + (30 * a2.priceUnit) + (24 * a3.priceUnit)).toFixed(2)),
    },
    {
      id: "okucia",
      name: "OKUCIA",
      items: [
        { lp: 7, element: o1.element, quantity: 8, unit: o1.unit, priceUnit: o1.priceUnit, priceTotal: parseFloat((8 * o1.priceUnit).toFixed(2)), description: "Biała", materialId: o1.materialId, matchScore: o1.matchScore },
        { lp: 8, element: o2.element, quantity: 24, unit: o2.unit, priceUnit: o2.priceUnit, priceTotal: parseFloat((24 * o2.priceUnit).toFixed(2)), description: "Skrzydła okienne", materialId: o2.materialId, matchScore: o2.matchScore },
      ],
      sectionTotal: parseFloat(((8 * o1.priceUnit) + (24 * o2.priceUnit)).toFixed(2)),
    },
    {
      id: "wypelnienia",
      name: "WYPEŁNIENIA",
      items: [
        { lp: 9, element: w1.element, quantity: 8.50, unit: w1.unit, priceUnit: w1.priceUnit, priceTotal: parseFloat((8.50 * w1.priceUnit).toFixed(2)), description: "Pakiet 2-szybowy", materialId: w1.materialId, matchScore: w1.matchScore },
      ],
      sectionTotal: parseFloat((8.50 * w1.priceUnit).toFixed(2)),
    },
  ];

  return sections;
}

// Główna akcja odczytu OCR RW
export const parseRwDocument = action({
  args: {
    orderId: v.id("orders"),
    fileItemId: v.optional(v.string()),
    fileBase64: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let base64 = args.fileBase64;
    let mimeType = args.mimeType || "application/pdf";

    if (!base64 && args.fileItemId) {
      try {
        const fetched = await fetchFileFromSharePoint(ctx, args.orderId, args.fileItemId);
        base64 = fetched.base64;
        mimeType = fetched.mimeType;
      } catch (err) {
        console.warn("SharePoint fetch error, using mock parser:", err);
      }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // Jeżeli brak klucza API lub wywołanie nie ma dostarczonego obrazu – zwróć dane z silnika Mock
    if (!anthropicKey || !base64) {
      const mockSections = await generateMockRwData(ctx, args.fileName);
      return {
        success: true,
        isMock: true,
        fileName: args.fileName,
        sections: mockSections,
        message: "Dokument przetworzony w trybie symulacji (Mock OCR). Podłącz klucz ANTHROPIC_API_KEY w env, aby włączyć analizę Claude 3.5 Sonnet Vision.",
      };
    }

    // Wywołanie Anthropic Claude 3.5 Sonnet Vision API jeśli klucz jest dostarczony
    try {
      const systemPrompt = `Jesteś zaawansowanym systemem OCR eksportującym dane z dokumentu Rozchodu Wewnętrznego (RW).
Twoim zadaniem jest odczytać wszystkie pozycje materiałowe z tabel na dokumencie RW i pogrupować je w spójne sekcje (np. PROFILE, OKUCIA, AKCESORIA, WYPEŁNIENIA).
Zwróć WYŁĄCZNIE poprawny kod JSON pasujący do następującej struktury:
{
  "sections": [
    {
      "id": "slug_sekcji",
      "name": "NAZWA SEKCJI",
      "items": [
        {
          "lp": 1,
          "element": "Nazwa materiału / elementu",
          "quantity": 10,
          "unit": "mb." | "szt." | "m²" | "kg" | "kpl.",
          "priceUnit": 25.50,
          "priceTotal": 255.00,
          "description": "dodatkowe uwagi lub puste"
        }
      ]
    }
  ]
}`;

      const mediaType = mimeType.includes("png") ? "image/png" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "image/jpeg" : "application/pdf";

      let contentBlock: any;
      if (mediaType === "application/pdf") {
        contentBlock = {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        };
      } else {
        contentBlock = {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64,
          },
        };
      }

      const modelsToTry = [
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
        "claude-opus-4-5-20251101",
        "claude-3-5-sonnet-20241022",
      ];

      let res: Response | null = null;
      let lastErrText = "";

      for (const m of modelsToTry) {
        try {
          const fetchRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: m,
              max_tokens: 4096,
              system: systemPrompt,
              messages: [
                {
                  role: "user",
                  content: [
                    contentBlock,
                    { type: "text", text: "Odczytaj wszystkie pozycje z załączonego dokumentu RW i zwróć strukturę JSON." },
                  ],
                },
              ],
            }),
          });

          if (fetchRes.ok) {
            res = fetchRes;
            break;
          } else {
            lastErrText = await fetchRes.text();
            console.warn(`[rwOcr] Anthropic model ${m} error (${fetchRes.status}): ${lastErrText}`);
            if (fetchRes.status === 404 || lastErrText.includes("not_found_error")) {
              continue;
            }
            break;
          }
        } catch (e: any) {
          console.warn(`[rwOcr] Failed to connect to model ${m}:`, e);
        }
      }

      if (!res || !res.ok) {
        console.warn(`Claude API error: ${lastErrText}. Falling back to Mock Parser.`);
        const mockSections = await generateMockRwData(ctx, args.fileName);
        return {
          success: true,
          isMock: true,
          fileName: args.fileName,
          sections: mockSections,
          message: `Odpowiedź Claude API: ${lastErrText.slice(0, 150)}. Użyto automatycznego silnika symulacji (Mock OCR).`,
        };
      }


      const data = await res.json();
      const rawText = data.content?.[0]?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Nie udało się wyodrębnić JSON z odpowiedzi Claude API.");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const materialsList = (await ctx.runQuery(api.materials.list, {})) ?? [];

      // Dopasowywanie materiałów z bazy
      const processedSections: ParsedRwSection[] = (parsed.sections || []).map((sec: any, idx: number) => {
        const items: ParsedRwItem[] = (sec.items || []).map((it: any, iIdx: number) => {
          const matched = materialsList.find((m: any) =>
            m.name.toLowerCase() === it.element.toLowerCase() ||
            (m.sku && m.sku.toLowerCase() === it.element.toLowerCase())
          );
          return {
            lp: it.lp || (iIdx + 1),
            element: it.element,
            quantity: Number(it.quantity) || 0,
            unit: it.unit || "szt.",
            priceUnit: Number(it.priceUnit) || 0,
            priceTotal: Number(it.priceTotal) || (Number(it.quantity || 0) * Number(it.priceUnit || 0)),
            description: it.description || "",
            materialId: matched?._id,
            matchScore: matched ? 0.95 : 0,
          };
        });

        const sectionTotal = items.reduce((sum, item) => sum + item.priceTotal, 0);
        return {
          id: sec.id || `sec_${idx}`,
          name: sec.name || `SEKCJA ${idx + 1}`,
          items,
          sectionTotal: parseFloat(sectionTotal.toFixed(2)),
        };
      });

      return {
        success: true,
        isMock: false,
        fileName: args.fileName,
        sections: processedSections,
      };
    } catch (err: any) {
      console.warn("OCR Exception, fallback to Mock:", err);
      const mockSections = await generateMockRwData(ctx, args.fileName);
      return {
        success: true,
        isMock: true,
        fileName: args.fileName,
        sections: mockSections,
        message: `Błąd przetworzenia przez API (${err.message || "Błąd sieci"}). Użyto awaryjnego silnika symulacji (Mock OCR).`,
      };
    }
  },
});
