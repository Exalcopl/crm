import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Exalco Tasks",
    short_name: "Zadania",
    description: "Exalco CRM Mobile Task Manager",
    start_url: "/app",
    // scope: "/" pozwala na poprawne działanie manifestu serwowanego z roota
    // (manifest.webmanifest jest pod /, więc scope musi być "/" lub podkatalogiem)
    scope: "/",
    // "fullscreen" chowa pasek statusu i pasek nawigacyjny Androida
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#0b0f19",
    theme_color: "#0b0f19",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
