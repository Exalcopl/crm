"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Link zakodowany w etykiecie — otwiera skaner PWA od razu na tym indeksie. */
export function buildScanUrl(sku: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/app/wms/scan?sku=${encodeURIComponent(sku)}`;
}

/** Kod QR renderowany lokalnie jako SVG (bez zewnętrznych usług). */
export function QrSvg({ value, size = 160 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div
      style={{ width: size, height: size, background: "#fff", lineHeight: 0 }}
      // SVG generowane lokalnie przez bibliotekę qrcode
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg", `<svg width="${size}" height="${size}"`) }}
    />
  );
}

/** Pobiera etykietę (QR + SKU) jako PNG. */
export async function downloadLabelPng(sku: string) {
  const qrSize = 600;
  const pad = 40;
  const textH = 120;
  const canvas = document.createElement("canvas");
  canvas.width = qrSize + pad * 2;
  canvas.height = qrSize + pad * 2 + textH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, buildScanUrl(sku), { width: qrSize, margin: 0, errorCorrectionLevel: "M" });
  ctx.drawImage(qrCanvas, pad, pad, qrSize, qrSize);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 88;
  ctx.font = `700 ${fontSize}px ui-monospace, Menlo, monospace`;
  while (ctx.measureText(sku).width > canvas.width - pad * 2 && fontSize > 24) {
    fontSize -= 4;
    ctx.font = `700 ${fontSize}px ui-monospace, Menlo, monospace`;
  }
  ctx.fillText(sku, canvas.width / 2, qrSize + pad + textH / 2 + 10);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `etykieta-${sku.replace(/[^A-Za-z0-9_-]+/g, "_")}.png`;
  a.click();
}
