// Dane konfiguratorów — kopie z alco-website/lib/products.ts
// Muszą być zsynchronizowane z konfiguratorem www.

export const CRM_COLORS = [
  { id: "antracyt", name: "Antracyt RAL 7016", group: "standard", swatch: "oklch(0.32 0.008 255)" },
  { id: "czarny", name: "Czarny mat RAL 9005", group: "standard", swatch: "oklch(0.2 0 0)" },
  { id: "bialy", name: "Biały RAL 9016", group: "standard", swatch: "oklch(0.97 0 0)" },
  { id: "srebrny", name: "Srebrny RAL 9006", group: "standard", swatch: "oklch(0.78 0.006 255)" },
  { id: "braz", name: "Brąz RAL 8017", group: "nonstandard", swatch: "oklch(0.35 0.04 55)" },
  { id: "zielony", name: "Zielony RAL 6005", group: "nonstandard", swatch: "oklch(0.35 0.05 145)" },
  { id: "grafit", name: "Grafit RAL 7024", group: "nonstandard", swatch: "oklch(0.3 0.005 255)" },
  { id: "zloty-dab", name: "Złoty dąb", group: "decor", swatch: "oklch(0.6 0.08 70)" },
  { id: "orzech", name: "Orzech", group: "decor", swatch: "oklch(0.45 0.06 60)" },
  { id: "bialy-polysk", name: "Biały połysk", group: "decor", swatch: "oklch(0.9 0.01 90)" },
];

// Pergola
export const CRM_ROOF_TYPES = [
  { id: "przyścienna", name: "Przyścienna", desc: "Montaż do elewacji budynku" },
  { id: "wolnostojąca", name: "Wolnostojąca", desc: "Samonośna konstrukcja na słupach" },
  { id: "opaska-betonowa", name: "Opaska betonowa", desc: "Montaż na opasce betonowej" },
];

export const CRM_ORIENTATIONS = [
  { id: "lewa", name: "Lewa" },
  { id: "prawa", name: "Prawa" },
];

export const CRM_LIGHTING_OPTIONS = [
  {
    id: "liniowe-obwod",
    name: "Liniowe po obwodzie",
    subOptions: [
      { id: "biale-zimny", name: "Białe – zimny" },
      { id: "biale-neutralny", name: "Białe – neutralny" },
      { id: "biale-ciepły", name: "Białe – ciepły" },
      { id: "rgb", name: "RGB" },
    ],
  },
  {
    id: "liniowe-lamelach",
    name: "Liniowe w lamelach",
    subOptions: [
      { id: "biale-zimny", name: "Białe – zimny" },
      { id: "biale-neutralny", name: "Białe – neutralny" },
      { id: "biale-ciepły", name: "Białe – ciepły" },
      { id: "rgb", name: "RGB" },
    ],
  },
  {
    id: "punktowe-lamelach",
    name: "Punktowe w lamelach",
    subOptions: [
      { id: "biale-zimny", name: "Białe – zimny" },
      { id: "biale-neutralny", name: "Białe – neutralny" },
      { id: "biale-ciepły", name: "Białe – ciepły" },
    ],
  },
];

export const CRM_SIDE_ENCLOSURES = [
  {
    id: "stale",
    name: "Stałe",
    variants: [
      { id: "wzor-1", name: "Wzór 1" },
      { id: "wzor-2", name: "Wzór 2" },
      { id: "wzor-3", name: "Wzór 3" },
    ],
  },
  {
    id: "przesuwne",
    name: "Przesuwne",
    variants: [
      { id: "caloszklane", name: "Całoszklane" },
      { id: "aluminiowe", name: "Aluminiowe" },
    ],
  },
  {
    id: "shuttersy",
    name: "Shuttersy",
    variants: [
      { id: "pionowe", name: "Pionowe" },
      { id: "poziome", name: "Poziome" },
    ],
  },
  {
    id: "zippy",
    name: "Zippy",
    variants: [
      { id: "wzor-1", name: "Wzór 1" },
      { id: "wzor-2", name: "Wzór 2" },
    ],
  },
];

export const CRM_ADDONS = [
  { id: "rain-sensor", name: "Czujnik deszczu", desc: "Automatyczne zamykanie lameli przy deszczu", price: 980 },
  { id: "wind-sensor", name: "Czujnik wiatru", desc: "Automatyczne zamykanie lameli przy wietrze", price: 980 },
  { id: "heater", name: "Promiennik ciepła", desc: "Ogrzewanie tarasu 2 kW", price: 1290 },
];

// Zadaszenia
export const CRM_ZADASZENIA_TYPES = [
  { id: "przyscienne", name: "Przyścienne" },
  { id: "wolnostojace", name: "Wolnostojące" },
];

export const CRM_ZADASZENIA_ROOF_TYPES = [
  { id: "szklo", name: "Szkło" },
  { id: "poliweglan", name: "Poliwęglan" },
  { id: "panel-nieprzezierny", name: "Panel nieprzezierny" },
  { id: "inne", name: "Inne" },
];

export const CRM_ZADASZENIA_LIGHTING = [
  {
    id: "liniowe-krokwie",
    name: "Liniowe w krokwiach",
    subOptions: [
      { id: "biale-zimny", name: "Białe – zimny" },
      { id: "biale-neutralny", name: "Białe – neutralny" },
      { id: "biale-cieply", name: "Białe – ciepły" },
      { id: "rgb", name: "RGB" },
    ],
  },
  {
    id: "punktowe-krokwie",
    name: "Punktowe w krokwiach",
    subOptions: [
      { id: "biale-zimny", name: "Białe – zimny" },
      { id: "biale-neutralny", name: "Białe – neutralny" },
      { id: "biale-cieply", name: "Białe – ciepły" },
    ],
  },
];

export const CRM_ZADASZENIA_ADDONS = [
  { id: "promiennik-ciepla", name: "Promiennik ciepła", desc: "Ogrzewanie tarasu 2 kW", price: 0 },
];
