"use client";

import React, { useMemo } from "react";

/**
 * Generator kodów QR zgodny ze standardem ISO/IEC 18004 (Byte mode, korekcja błędów L/M).
 * Renderuje czysty wektorowy <svg>, idealny do wydruków na drukarkach etykiet (Zebra, Brother, Dymo, A4)
 * bez rozmycia i bez zewnętrznych zależności.
 */

type VersionSpec = {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignment: number[];
};

// Specyfikacje dla poziomów korekcji L (1 blok danych dla wersji 1–5, do 106 bajtów UTF-8)
const VERSION_SPECS_L: VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignment: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignment: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignment: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignment: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignment: [6, 30] },
];

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >> 7) * 0x11d);
    z ^= ((y >> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[divisor.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMul(divisor[i], factor);
    }
  }
  return result;
}

function getBit(val: number, i: number): boolean {
  return ((val >>> i) & 1) !== 0;
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text || " ");
  const spec =
    VERSION_SPECS_L.find((s) => bytes.length + 2 <= s.dataCodewords) ??
    VERSION_SPECS_L[VERSION_SPECS_L.length - 1];

  const maxPayload = spec.dataCodewords - 2;
  const payload = bytes.length > maxPayload ? bytes.slice(0, maxPayload) : bytes;

  // 1. Budowa strumienia bitów (Byte mode = 0100)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4); // Mode: Byte
  pushBits(payload.length, 8); // Character count (8 bits dla V1-9)
  for (const b of payload) pushBits(b, 8);

  const capacityBits = spec.dataCodewords * 8;
  pushBits(0, Math.min(4, capacityBits - bits.length)); // Terminator
  while (bits.length % 8 !== 0) bits.push(0); // Wyrównanie do bajtu

  const dataCodewords = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    dataCodewords[i] = byte;
  }
  let padIdx = 0;
  for (let i = bits.length / 8; i < spec.dataCodewords; i++) {
    dataCodewords[i] = padIdx % 2 === 0 ? 0xec : 0x11;
    padIdx++;
  }

  // 2. Korekcja błędów Reed-Solomon
  const divisor = reedSolomonDivisor(spec.ecCodewords);
  const ecCodewords = reedSolomonRemainder(dataCodewords, divisor);

  const allCodewords = new Uint8Array(spec.dataCodewords + spec.ecCodewords);
  allCodewords.set(dataCodewords, 0);
  allCodewords.set(ecCodewords, spec.dataCodewords);

  // 3. Inicjalizacja matrycy
  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (x: number, y: number, isDark: boolean) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      modules[y][x] = isDark;
      isFunction[y][x] = true;
    }
  };

  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Finder patterns (3 narożniki 7x7 + separator)
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          setFunctionModule(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Alignment patterns (5x5)
  const align = spec.alignment;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) {
        continue;
      }
      const cx = align[i];
      const cy = align[j];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Rezerwacja miejsc pod bity formatu
  const drawFormatBits = (mask: number) => {
    // ECL L = 01
    const data = (0b01 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits15 = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) setFunctionModule(8, i, getBit(bits15, i));
    setFunctionModule(8, 7, getBit(bits15, 6));
    setFunctionModule(8, 8, getBit(bits15, 7));
    setFunctionModule(7, 8, getBit(bits15, 8));
    for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getBit(bits15, i));

    for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, getBit(bits15, i));
    for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, getBit(bits15, i));
    setFunctionModule(8, size - 8, true); // Dark module
  };

  drawFormatBits(0);

  // 4. Wypełnienie bitów danych (zygzak od prawego dolnego rogu)
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIdx < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIdx >>> 3], 7 - (bitIdx & 7));
          bitIdx++;
        }
      }
    }
  }

  // 5. Zastosowanie maski 0: (x + y) % 2 === 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && (x + y) % 2 === 0) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
  drawFormatBits(0);

  return modules;
}

export function renderQrSvgString(value: string, size = 140, margin = 2): string {
  const matrix = generateQrMatrix(value);
  const n = matrix.length;
  const viewSize = n + margin * 2;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        path += `M${x + margin},${y + margin}h1v1h-1z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}

export function QrCodeSvg({
  value,
  size = 120,
  margin = 2,
}: {
  value: string;
  size?: number;
  margin?: number;
}) {
  const { viewSize, path } = useMemo(() => {
    const matrix = generateQrMatrix(value);
    const n = matrix.length;
    let p = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (matrix[y][x]) {
          p += `M${x + margin},${y + margin}h1v1h-1z`;
        }
      }
    }
    return { viewSize: n + margin * 2, path: p };
  }, [value, margin]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ display: "block", borderRadius: 4, background: "#fff" }}
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
