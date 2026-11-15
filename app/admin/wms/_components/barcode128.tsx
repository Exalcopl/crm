"use client";

import React, { useMemo } from "react";

/**
 * Wektorowy generator kodów kreskowych Code 128 (Code Set B) jako <svg>.
 * Obsługuje pełny zakres drukowalnych znaków ASCII (32–126) i daje ostry wydruk
 * dla skanerów laserowych 1D (np. Symbol TC55).
 */

// Wzorce szerokości pasków i przerw dla symboli 0..106 w standardzie ISO/IEC 15417 (Code 128).
const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;
const QUIET_ZONE_MODULES = 10;

function encodeCode128B(value: string): { bars: Array<{ x: number; w: number }>; totalWidth: number } {
  const clean = Array.from(value)
    .map((ch) => ch.charCodeAt(0))
    .filter((code) => code >= 32 && code <= 126);

  const values: number[] = [START_B];
  let checksum = START_B;

  clean.forEach((code, idx) => {
    const sym = code - 32;
    values.push(sym);
    checksum += (idx + 1) * sym;
  });

  values.push(checksum % 103);
  values.push(STOP);

  const bars: Array<{ x: number; w: number }> = [];
  let cursor = QUIET_ZONE_MODULES;

  for (const sym of values) {
    const pattern = CODE128_PATTERNS[sym];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }

  return { bars, totalWidth: cursor + QUIET_ZONE_MODULES };
}

export function Barcode128Svg({
  value,
  height = 48,
  className,
  style,
}: {
  value: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { bars, totalWidth } = useMemo(() => encodeCode128B(value), [value]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", background: "#ffffff", ...style }}
      aria-label={`Kod kreskowy ${value}`}
    >
      <rect x={0} y={0} width={totalWidth} height={height} fill="#ffffff" />
      {bars.map((b, idx) => (
        <rect key={idx} x={b.x} y={0} width={b.w} height={height} fill="#000000" />
      ))}
    </svg>
  );
}

/** Pobiera etykietę z kodem kreskowym Code 128 + SKU jako PNG. */
export function downloadBarcode128Png(sku: string) {
  const { bars, totalWidth } = encodeCode128B(sku);
  const scale = 6;
  const pad = 40;
  const barH = 220;
  const textH = 110;
  const width = totalWidth * scale + pad * 2;
  const height = barH + pad * 2 + textH;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  for (const b of bars) {
    ctx.fillRect(pad + b.x * scale, pad, b.w * scale, barH);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 64;
  ctx.font = `700 ${fontSize}px ui-monospace, Menlo, monospace`;
  while (ctx.measureText(sku).width > width - pad * 2 && fontSize > 24) {
    fontSize -= 4;
    ctx.font = `700 ${fontSize}px ui-monospace, Menlo, monospace`;
  }
  ctx.fillText(sku, width / 2, pad + barH + textH / 2 + 8);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `kod1d-${sku.replace(/[^A-Za-z0-9_-]+/g, "_")}.png`;
  a.click();
}

/** Pobiera etykietę z kodem kreskowym Code 128 + SKU jako wektorowy plik SVG. */
export function downloadBarcode128Svg(sku: string) {
  const { bars, totalWidth } = encodeCode128B(sku);
  const scale = 3;
  const pad = 20;
  const barH = 110;
  const textH = 44;
  const width = totalWidth * scale + pad * 2;
  const height = barH + pad * 2 + textH;
  const escapedSku = sku
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const rects = bars
    .map((b) => `<rect x="${pad + b.x * scale}" y="${pad}" width="${b.w * scale}" height="${barH}" fill="#000000"/>`)
    .join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
    rects,
    `<text x="${width / 2}" y="${pad + barH + 30}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="26" font-weight="700" fill="#000000">${escapedSku}</text>`,
    `</svg>`,
  ].join("");

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kod1d-${sku.replace(/[^A-Za-z0-9_-]+/g, "_")}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
