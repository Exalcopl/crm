"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Download,
  Pen,
  Check,
  Move,
  PlusCircle,
  Palette,
  Undo2,
  Redo2,
  Trash2,
  RotateCcw,
  Eye,
  Type,
  Ruler,
  CornerDownRight,
} from "lucide-react";

export interface ProfileNode {
  id: string;
  x: number;
  y: number;
}

export interface SegmentCustomization {
  label?: string; // Np. "A", "B", "C"
  lengthMm?: number; // Dokładna wartość w mm, np. 70, 50, 15, 1.5
  showColorSide?: boolean; // Czy ta strona ma oznaczenie "KOLOR ▼"
  colorSideOrientation?: "above" | "below";
}

export interface AngleCustomization {
  overrideText?: string; // Np. "90°", "135°", "45°", "150°"
}

interface PaintEditorProps {
  onApply: (file: File) => void;
}

type Mode = "profile_add" | "profile_select" | "profile_color" | "freehand";

// Wyznaczanie dociągnięcia do ortogonalnych kątów (0°, 45°, 90°, 135°, 180°...)
function snapToOrtho(start: { x: number; y: number }, current: { x: number; y: number }) {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const distance = Math.hypot(dx, dy);
  return {
    x: start.x + distance * Math.cos(snappedAngle),
    y: start.y + distance * Math.sin(snappedAngle),
  };
}

// Domyślne litery wymiarowe dla kolejnych segmentów
const DEFAULT_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

export function PaintEditor({ onApply }: PaintEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Główne stany profilu CAD
  const [nodes, setNodes] = useState<ProfileNode[]>([]);
  const [segmentCustoms, setSegmentCustoms] = useState<Record<number, SegmentCustomization>>({});
  const [angleCustoms, setAngleCustoms] = useState<Record<number, AngleCustomization>>({});

  // Przelicznik skali (1 piksel = N mm, domyślnie 1.0)
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);

  // Tryby i narzędzia
  const [mode, setMode] = useState<Mode>("profile_add");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [profileColor, setProfileColor] = useState("#dc2626"); // Czerwony kolor profilu

  // Rysowanie swobodne (Freehand)
  const [freehandColor] = useState("#000000");
  const [lineWidth] = useState(3);
  const freehandCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Kursor myszy na żywo (dla podglądu dociągania linii)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);

  // Historia do Undo / Redo
  const [history, setHistory] = useState<{
    nodes: ProfileNode[];
    segmentCustoms: Record<number, SegmentCustomization>;
    angleCustoms: Record<number, AngleCustomization>;
  }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Modal edycji wymiaru segmentu
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [editingLengthMmValue, setEditingLengthMmValue] = useState("");

  // Modal edycji kąta gięcia
  const [editingAngleIndex, setEditingAngleIndex] = useState<number | null>(null);
  const [editingAngleValue, setEditingAngleValue] = useState("");

  const pushHistory = useCallback(
    (newNodes: ProfileNode[], newSegs = segmentCustoms, newAngles = angleCustoms) => {
      const state = {
        nodes: JSON.parse(JSON.stringify(newNodes)),
        segmentCustoms: JSON.parse(JSON.stringify(newSegs)),
        angleCustoms: JSON.parse(JSON.stringify(newAngles)),
      };
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(state);
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    },
    [history, historyIndex, segmentCustoms, angleCustoms]
  );

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setSegmentCustoms(prev.segmentCustoms);
      setAngleCustoms(prev.angleCustoms);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setSegmentCustoms(next.segmentCustoms);
      setAngleCustoms(next.angleCustoms);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Obsługa klawiszy (Shift, Escape, Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(true);
      if (e.key === "Escape") {
        setActiveNodeId(null);
        if (mode === "profile_add" && nodes.length > 0) {
          setMode("profile_select");
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) redo();
        else undo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [nodes, mode, historyIndex, history]);

  // Inicjalizacja pomocniczego canvas dla wolnego rysowania oraz ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (!freehandCanvasRef.current) {
      freehandCanvasRef.current = document.createElement("canvas");
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (canvas.width !== width || canvas.height !== height) {
          const fhCanvas = freehandCanvasRef.current;
          let existingData: ImageData | null = null;
          if (fhCanvas && fhCanvas.width > 0 && fhCanvas.height > 0) {
            const fhCtx = fhCanvas.getContext("2d");
            if (fhCtx) existingData = fhCtx.getImageData(0, 0, fhCanvas.width, fhCanvas.height);
          }

          canvas.width = width;
          canvas.height = height;
          if (fhCanvas) {
            fhCanvas.width = width;
            fhCanvas.height = height;
            if (existingData) {
              const fhCtx = fhCanvas.getContext("2d");
              fhCtx?.putImageData(existingData, 0, 0);
            }
          }
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // RENDEROWANIE GŁÓWNEGO EDYTORA NA CANVAS
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background (Czysta biała kartka papieru technicznego)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rysowanie siatki milimetrowej w tle
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 1. Rysowanie wyrenderowanego layeru freehand
    if (freehandCanvasRef.current) {
      ctx.drawImage(freehandCanvasRef.current, 0, 0);
    }

    // Jeśli brak wierzchołków, wyrenderuj napis zachęcający
    if (nodes.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Kliknij na płótnie, aby rozpocząć rysowanie profilu (obróbki blacharskiej)",
        canvas.width / 2,
        canvas.height / 2
      );
      return;
    }

    // Pomocnicza lista wszystkich punktów (łącznie z rubberband cursor w trybie add)
    let effectiveNodes = [...nodes];
    if (mode === "profile_add" && mousePos && nodes.length > 0) {
      let nextPos = mousePos;
      if (isShiftPressed) {
        nextPos = snapToOrtho(nodes[nodes.length - 1], mousePos);
      }
      effectiveNodes.push({ id: "preview", x: nextPos.x, y: nextPos.y });
    }

    // 2. RYSOWANIE LINII OBSZARU "KOLOR ▼" DLA SEGMENTÓW
    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      const custom = segmentCustoms[i] || {};

      if (custom.showColorSide) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const ux = dx / len;
          const uy = dy / len;
          const nx = -uy;
          const ny = ux;
          const cOffset = custom.colorSideOrientation === "below" ? -7 : 7;

          // Rysuj podwójną linię koloru (czerwony pasek powłoki)
          ctx.beginPath();
          ctx.moveTo(p1.x + nx * cOffset, p1.y + ny * cOffset);
          ctx.lineTo(p2.x + nx * cOffset, p2.y + ny * cOffset);
          ctx.strokeStyle = "#e11d48";
          ctx.lineWidth = 3;
          ctx.stroke();

          // Tekst "KOLOR ▼" na środku segmentu
          const mx = (p1.x + p2.x) / 2 + nx * (cOffset > 0 ? 18 : -18);
          const my = (p1.y + p2.y) / 2 + ny * (cOffset > 0 ? 18 : -18);

          ctx.save();
          ctx.fillStyle = "#e11d48";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("KOLOR ▼", mx, my);
          ctx.restore();
        }
      }
    }

    // 3. RYSOWANIE GŁÓWNEGO PROFILU (Czerwona gruba linia gięcia)
    ctx.beginPath();
    ctx.moveTo(effectiveNodes[0].x, effectiveNodes[0].y);
    for (let i = 1; i < effectiveNodes.length; i++) {
      ctx.lineTo(effectiveNodes[i].x, effectiveNodes[i].y);
    }
    ctx.strokeStyle = profileColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Rysowanie podglądu ostaniej linii przerywanej w trybie dodawania
    if (mode === "profile_add" && effectiveNodes.length > nodes.length) {
      const pPrev = nodes[nodes.length - 1];
      const pNext = effectiveNodes[effectiveNodes.length - 1];
      ctx.beginPath();
      ctx.moveTo(pPrev.x, pPrev.y);
      ctx.lineTo(pNext.x, pNext.y);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. RYSOWANIE LINII WYMIAROWYCH ORAZ ETYKIET SEGMENTÓW (A, B, C... Z DŁUGOŚCIĄ W MM)
    const calculatedSegmentLengths: number[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const pxLen = Math.hypot(dx, dy);

      if (pxLen < 2) {
        calculatedSegmentLengths.push(0);
        continue;
      }

      // Wyznaczenie wartości w mm
      const custom = segmentCustoms[i] || {};
      const calculatedMm = Math.round(pxLen * scaleFactor);
      const finalMm = custom.lengthMm !== undefined ? custom.lengthMm : calculatedMm;
      calculatedSegmentLengths.push(finalMm);

      const ux = dx / pxLen;
      const uy = dy / pxLen;
      const nx = -uy;
      const ny = ux;

      const offset = 34; // Odstęp linii wymiarowej
      const dimP1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
      const dimP2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };

      // Linie pomocnicze ograniczające (extension lines)
      ctx.beginPath();
      ctx.moveTo(p1.x + nx * 4, p1.y + ny * 4);
      ctx.lineTo(p1.x + nx * (offset + 6), p1.y + ny * (offset + 6));
      ctx.moveTo(p2.x + nx * 4, p2.y + ny * 4);
      ctx.lineTo(p2.x + nx * (offset + 6), p2.y + ny * (offset + 6));
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Glówna linia wymiarowa ze strzałkami
      ctx.beginPath();
      ctx.moveTo(dimP1.x, dimP1.y);
      ctx.lineTo(dimP2.x, dimP2.y);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rysowanie strzałek na końcach linii wymiarowej
      const arrowSize = 6;
      const drawArrowHead = (fromX: number, fromY: number, dirX: number, dirY: number) => {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(
          fromX - dirX * arrowSize + dirY * (arrowSize / 2),
          fromY - dirY * arrowSize - dirX * (arrowSize / 2)
        );
        ctx.lineTo(
          fromX - dirX * arrowSize - dirY * (arrowSize / 2),
          fromY - dirY * arrowSize + dirX * (arrowSize / 2)
        );
        ctx.closePath();
        ctx.fillStyle = "#0f172a";
        ctx.fill();
      };
      drawArrowHead(dimP1.x, dimP1.y, ux, uy);
      drawArrowHead(dimP2.x, dimP2.y, -ux, -uy);

      // Nazwa i wartość wymiaru (np. "A [ 70 mm ]")
      const labelName = custom.label || DEFAULT_LABELS[i] || `L${i + 1}`;
      const labelText = `${labelName} [ ${finalMm} mm ]`;
      const midX = (dimP1.x + dimP2.x) / 2;
      const midY = (dimP1.y + dimP2.y) / 2;

      ctx.save();
      ctx.translate(midX, midY);

      // Orientacja tekstu (zawsze czytelny od lewej do prawej / od dołu do góry)
      let textAngle = Math.atan2(dy, dx);
      if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
        textAngle += Math.PI;
      }
      ctx.rotate(textAngle);

      // Tło dla etykiety
      ctx.font = "bold 12px sans-serif";
      const metrics = ctx.measureText(labelText);
      const bgW = metrics.width + 12;
      const bgH = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-bgW / 2, -bgH / 2, bgW, bgH);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(-bgW / 2, -bgH / 2, bgW, bgH);

      // Tekst wymiaru
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    }

    // 5. RYSOWANIE KĄTÓW GIĘCIA W STOPNIACH NA WSZYSTKICH WIERZCHOŁKACH GIĘCIA
    for (let i = 1; i < nodes.length - 1; i++) {
      const pPrev = nodes[i - 1];
      const pCurr = nodes[i];
      const pNext = nodes[i + 1];

      const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
      const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

      const len1 = Math.hypot(v1.x, v1.y);
      const len2 = Math.hypot(v2.x, v2.y);
      if (len1 === 0 || len2 === 0) continue;

      const a1 = Math.atan2(v1.y, v1.x);
      const a2 = Math.atan2(v2.y, v2.x);

      // Obliczanie kąta gięcia w stopniach
      let diff = a2 - a1;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const angleRad = Math.abs(diff);
      const angleDeg = Math.round((angleRad * 180) / Math.PI);

      const customAngleText = angleCustoms[i]?.overrideText || `${angleDeg}°`;

      // Łuk wymiarowy
      const radius = 24;
      let startAngle = a1;
      let endAngle = a2;
      if (diff < 0) {
        startAngle = a2;
        endAngle = a1;
      }

      ctx.beginPath();
      ctx.arc(pCurr.x, pCurr.y, radius, startAngle, endAngle, false);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Wektor środkowy kąta do umieszczenia napisu stopni
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const labelDist = radius + 15;
      const lx = pCurr.x + Math.cos(midAngle) * labelDist;
      const ly = pCurr.y + Math.sin(midAngle) * labelDist;

      // Badżet / Napis kąta
      ctx.save();
      ctx.font = "bold 11px sans-serif";
      const angleMetrics = ctx.measureText(customAngleText);
      const abgW = angleMetrics.width + 8;
      const abgH = 16;

      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(lx - abgW / 2, ly - abgH / 2, abgW, abgH);
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1;
      ctx.strokeRect(lx - abgW / 2, ly - abgH / 2, abgW, abgH);

      ctx.fillStyle = "#1d4ed8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(customAngleText, lx, ly);
      ctx.restore();
    }

    // 6. RYSOWANIE WIERZCHOŁKÓW (PUNKTÓW GIĘCIA)
    nodes.forEach((node, idx) => {
      const isSelected = node.id === activeNodeId;
      ctx.beginPath();
      ctx.arc(node.x, node.y, isSelected ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#ef4444" : "#2563eb";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Numer wierzchołka
      ctx.fillStyle = "#475569";
      ctx.font = "600 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${idx + 1}`, node.x, node.y - 10);
    });

    // 7. TABELA LEGENDY SPECIFIKACJI ORAZ SUMY ROZWINIĘCIA BLACHY (W MM)
    if (showLegend && nodes.length > 1) {
      const padding = 12;
      const boxWidth = 205;
      const lineHeight = 20;
      const segCount = nodes.length - 1;

      // Liczenie sumy rozwinięcia blachy (w mm)
      let totalMm = 0;
      for (let i = 0; i < segCount; i++) {
        totalMm += calculatedSegmentLengths[i] || 0;
      }

      const boxHeight = 28 + segCount * lineHeight + 30;
      const boxX = canvas.width - boxWidth - 16;
      const boxY = canvas.height - boxHeight - 16;

      ctx.save();
      // Tło tabelki legendarnej
      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Nagłówek Legendy
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("ROZWINIĘCIE PROFILU (MM)", boxX + padding, boxY + 18);

      // Wiersze poszczególnych wymiarów
      for (let i = 0; i < segCount; i++) {
        const labelName = segmentCustoms[i]?.label || DEFAULT_LABELS[i] || `L${i + 1}`;
        const valMm = calculatedSegmentLengths[i] || 0;
        const hasColor = segmentCustoms[i]?.showColorSide;

        const rowY = boxY + 36 + i * lineHeight;
        
        ctx.fillStyle = "#334155";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`${labelName}:`, boxX + padding, rowY);

        ctx.fillStyle = "#0f172a";
        ctx.font = "600 11px monospace";
        ctx.fillText(`${valMm} mm`, boxX + padding + 30, rowY);

        if (hasColor) {
          ctx.fillStyle = "#e11d48";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("🎨 KOLOR", boxX + padding + 125, rowY);
        }
      }

      // Linia podsumowania (Suma rozwinięcia)
      const totalY = boxY + 36 + segCount * lineHeight + 8;
      ctx.beginPath();
      ctx.moveTo(boxX + padding, totalY - 14);
      ctx.lineTo(boxX + boxWidth - padding, totalY - 14);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("SUMA ROZWINIĘCIA:", boxX + padding, totalY);
      ctx.font = "bold 12px monospace";
      ctx.fillText(`${totalMm} mm`, boxX + padding + 125, totalY);

      ctx.restore();
    }
  }, [
    nodes,
    segmentCustoms,
    angleCustoms,
    scaleFactor,
    mode,
    mousePos,
    isShiftPressed,
    activeNodeId,
    showLegend,
    profileColor,
  ]);

  // Ponowne przeliczenie i wyrenderowanie przy każdej zmianie stanu
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // MYSZKA: KLIKNIĘCIE NA PŁÓTNIE (MOUSEDOWN)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === "freehand") {
      const fhCtx = freehandCanvasRef.current?.getContext("2d");
      if (fhCtx) {
        fhCtx.beginPath();
        fhCtx.moveTo(x, y);
      }
      setIsDraggingNode(true);
      return;
    }

    // 1. Sprawdź czy kliknięto w istniejący wierzchołek
    const clickedNodeIndex = nodes.findIndex((n) => Math.hypot(n.x - x, n.y - y) <= 12);

    if (mode === "profile_color") {
      // Kliknięcie w pobliżu segmentu dodaje / przełącza KOLOR ▼
      for (let i = 0; i < nodes.length - 1; i++) {
        const p1 = nodes[i];
        const p2 = nodes[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        if (Math.hypot(midX - x, midY - y) < 40) {
          const updated = { ...segmentCustoms };
          const cur = updated[i] || {};
          updated[i] = {
            ...cur,
            showColorSide: !cur.showColorSide,
          };
          setSegmentCustoms(updated);
          pushHistory(nodes, updated);
          return;
        }
      }
    }

    if (clickedNodeIndex !== -1) {
      setActiveNodeId(nodes[clickedNodeIndex].id);
      setIsDraggingNode(true);
      if (mode === "profile_add") {
        setMode("profile_select");
      }
      return;
    }

    // 2. Sprawdź czy kliknięto w badżet kąta gięcia, aby go edytować
    for (let i = 1; i < nodes.length - 1; i++) {
      const pPrev = nodes[i - 1];
      const pCurr = nodes[i];
      const pNext = nodes[i + 1];
      const a1 = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
      const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
      let diff = a2 - a1;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      let startAngle = a1;
      let endAngle = a2;
      if (diff < 0) {
        startAngle = a2;
        endAngle = a1;
      }
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const lx = pCurr.x + Math.cos(midAngle) * 39;
      const ly = pCurr.y + Math.sin(midAngle) * 39;

      if (Math.hypot(lx - x, ly - y) <= 20) {
        const angleDeg = Math.round((Math.abs(diff) * 180) / Math.PI);
        setEditingAngleIndex(i);
        setEditingAngleValue(angleCustoms[i]?.overrideText || `${angleDeg}°`);
        return;
      }
    }

    // 3. Sprawdź czy kliknięto na etykietę wymiaru (np. A, B, C), aby ją edytować
    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      if (Math.hypot(midX - x, midY - y) <= 32) {
        const custom = segmentCustoms[i] || {};
        const pxLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const currentMm = custom.lengthMm !== undefined ? custom.lengthMm : Math.round(pxLen * scaleFactor);

        setEditingSegmentIndex(i);
        setEditingLabelValue(custom.label || DEFAULT_LABELS[i] || `L${i + 1}`);
        setEditingLengthMmValue(currentMm.toString());
        return;
      }
    }

    // Tryb dodawania punktów
    if (mode === "profile_add") {
      let newPoint = { x, y };
      if (isShiftPressed && nodes.length > 0) {
        newPoint = snapToOrtho(nodes[nodes.length - 1], newPoint);
      }
      const newNode: ProfileNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        x: newPoint.x,
        y: newPoint.y,
      };
      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      setActiveNodeId(newNode.id);
      pushHistory(updatedNodes);
    } else if (mode === "profile_select") {
      setActiveNodeId(null);
    }
  };

  // MYSZKA: RUCH (MOUSEMOVE)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    if (mode === "freehand" && isDraggingNode) {
      const fhCtx = freehandCanvasRef.current?.getContext("2d");
      if (fhCtx) {
        fhCtx.strokeStyle = freehandColor;
        fhCtx.lineWidth = lineWidth;
        fhCtx.lineCap = "round";
        fhCtx.lineTo(x, y);
        fhCtx.stroke();
        renderCanvas();
      }
      return;
    }

    // Przeciąganie aktywnego wierzchołka w trybie wyboru
    if (isDraggingNode && activeNodeId && mode === "profile_select") {
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id !== activeNodeId) return n;
          let target = { x, y };
          if (isShiftPressed) {
            const idx = prevNodes.findIndex((pn) => pn.id === activeNodeId);
            if (idx > 0) {
              target = snapToOrtho(prevNodes[idx - 1], target);
            }
          }
          return { ...n, x: target.x, y: target.y };
        })
      );
    }
  };

  // MYSZKA: ZWOLNIENIE (MOUSEUP)
  const handleMouseUp = () => {
    if (isDraggingNode) {
      setIsDraggingNode(false);
      pushHistory(nodes);
    }
  };

  // PODWÓJNE KLIKNIĘCIE - ZAKOŃCZENIE DODAWANIA PUNKTÓW
  const handleDoubleClick = () => {
    if (mode === "profile_add" && nodes.length > 0) {
      setMode("profile_select");
    }
  };

  // USUWANIE AKTYWNEGO PUNKTU
  const removeActiveNode = () => {
    if (!activeNodeId) return;
    const updated = nodes.filter((n) => n.id !== activeNodeId);
    setNodes(updated);
    setActiveNodeId(null);
    pushHistory(updated);
  };

  // WYCZYSZCZENIE CAŁEGO EDYTORA
  const clearAll = () => {
    setNodes([]);
    setSegmentCustoms({});
    setAngleCustoms({});
    setActiveNodeId(null);
    if (freehandCanvasRef.current) {
      const fhCtx = freehandCanvasRef.current.getContext("2d");
      fhCtx?.clearRect(0, 0, freehandCanvasRef.current.width, freehandCanvasRef.current.height);
    }
    pushHistory([], {}, {});
  };

  // ZAPIS I ZATWIERDZENIE GŁÓWNEGO SZKICU WEBP
  const handleApplyDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Przelicz przed wygenerowaniem podglądu
    renderCanvas();

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `szkic-profilu-${Date.now()}.webp`, {
          type: "image/webp",
        });
        onApply(file);
      },
      "image/webp",
      0.95
    );
  };

  // POBIERANIE OBRAZU PNG / JPG
  const downloadImage = (format: "png" | "jpeg") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas();
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const image = canvas.toDataURL(mimeType, 0.95);
    const link = document.createElement("a");
    link.href = image;
    link.download = `szkic-profilu-${Date.now()}.${format}`;
    link.click();
  };

  // ZAPIS EDYCJI ETYKIETY I WYMIARU MM Z MODALA
  const saveSegmentEdit = () => {
    if (editingSegmentIndex !== null) {
      const parsedMm = parseFloat(editingLengthMmValue.replace(",", "."));
      const updated = {
        ...segmentCustoms,
        [editingSegmentIndex]: {
          ...segmentCustoms[editingSegmentIndex],
          label: editingLabelValue.trim(),
          lengthMm: !isNaN(parsedMm) && parsedMm >= 0 ? parsedMm : undefined,
        },
      };
      setSegmentCustoms(updated);
      pushHistory(nodes, updated);
      setEditingSegmentIndex(null);
    }
  };

  // ZAPIS EDYCJI KĄTA GIĘCIA
  const saveAngleEdit = () => {
    if (editingAngleIndex !== null) {
      const updated = {
        ...angleCustoms,
        [editingAngleIndex]: {
          ...angleCustoms[editingAngleIndex],
          overrideText: editingAngleValue.trim(),
        },
      };
      setAngleCustoms(updated);
      pushHistory(nodes, segmentCustoms, updated);
      setEditingAngleIndex(null);
    }
  };

  const btnStyle = (isActive: boolean, variant: "blue" | "red" | "green" | "gray" = "blue"): React.CSSProperties => {
    const activeColor = variant === "red" ? "#f85149" : variant === "green" ? "#2ea043" : "#60a5fa";
    const activeBg = variant === "red" ? "rgba(248,81,73,0.15)" : variant === "green" ? "rgba(46,160,67,0.15)" : "rgba(96,165,250,0.15)";
    const activeBorder = variant === "red" ? "rgba(248,81,73,0.4)" : variant === "green" ? "rgba(46,160,67,0.4)" : "rgba(96,165,250,0.4)";

    return {
      background: isActive ? activeBg : "#21262d",
      border: isActive ? `1px solid ${activeBorder}` : "1px solid #30363d",
      color: isActive ? activeColor : "#c9d1d9",
      borderRadius: 6,
      padding: "6px 12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      transition: "all 120ms ease",
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      {/* PASEK NARZĘDZI (TOOLBAR) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          background: "#161b22",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #30363d",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("profile_add")}
          style={btnStyle(mode === "profile_add")}
          title="Klikaj na płótnie, aby dodawać wierzchołki profilu"
        >
          <PlusCircle size={14} /> 📐 Rysuj Profil
        </button>

        <button
          type="button"
          onClick={() => setMode("profile_select")}
          style={btnStyle(mode === "profile_select")}
          title="Przesuwaj wierzchołki i edytuj kształt profilu"
        >
          <Move size={14} /> ✋ Przesuń Punkt
        </button>

        <button
          type="button"
          onClick={() => setMode("profile_color")}
          style={btnStyle(mode === "profile_color", "red")}
          title="Kliknij na segment profilu, aby oznaczyć stronę malowaną (KOLOR ▼)"
        >
          <Palette size={14} /> 🎨 Strona Koloru
        </button>

        <button
          type="button"
          onClick={() => setMode("freehand")}
          style={btnStyle(mode === "freehand")}
          title="Dowolny ołówek do dodawania odręcznych notatek"
        >
          <Pen size={14} /> ✏️ Ołówek
        </button>

        <span style={{ borderLeft: "1px solid #30363d", height: 20, margin: "0 4px" }} />

        {/* PRZELICZNIK SKALI MM */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#8b949e",
            fontWeight: 600,
          }}
          title="Mnożnik przelicznika z pikseli na mm"
        >
          <Ruler size={14} style={{ color: "#60a5fa" }} /> Skala mm:
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(Math.max(0.1, parseFloat(e.target.value) || 1))}
            style={{
              width: 50,
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 4,
              color: "#f0f6fc",
              fontSize: 12,
              padding: "2px 6px",
            }}
          />
        </label>

        {/* KOLOR PROFILU */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#8b949e",
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          Profil:
          <input
            type="color"
            value={profileColor}
            onChange={(e) => setProfileColor(e.target.value)}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              border: "none",
              borderRadius: 4,
              background: "transparent",
              cursor: "pointer",
            }}
          />
        </label>

        {/* PRZYCISKI AKCJI COFNIJ / PONÓW */}
        <button
          type="button"
          onClick={undo}
          disabled={historyIndex <= 0}
          style={{
            ...btnStyle(false),
            opacity: historyIndex <= 0 ? 0.4 : 1,
            cursor: historyIndex <= 0 ? "not-allowed" : "pointer",
          }}
          title="Cofnij (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          style={{
            ...btnStyle(false),
            opacity: historyIndex >= history.length - 1 ? 0.4 : 1,
            cursor: historyIndex >= history.length - 1 ? "not-allowed" : "pointer",
          }}
          title="Ponów (Ctrl+Shift+Z)"
        >
          <Redo2 size={14} />
        </button>

        <span style={{ borderLeft: "1px solid #30363d", height: 20, margin: "0 4px" }} />

        {/* PRZEŁĄCZNIK LEGENDY */}
        <button
          type="button"
          onClick={() => setShowLegend(!showLegend)}
          style={btnStyle(showLegend)}
          title="Pokaż/ukryj tabelę legendarnej specyfikacji wymiarów"
        >
          <Eye size={14} /> Legenda
        </button>

        {activeNodeId && (
          <button
            type="button"
            onClick={removeActiveNode}
            style={{ ...btnStyle(false, "red"), marginLeft: "auto" }}
          >
            <Trash2 size={14} /> Usuń Punkt
          </button>
        )}

        <div style={{ display: "flex", gap: 6, marginLeft: activeNodeId ? 0 : "auto" }}>
          <button
            type="button"
            onClick={clearAll}
            style={{
              ...btnStyle(false, "red"),
              color: "#f85149",
              borderColor: "rgba(248,81,73,0.3)",
            }}
          >
            <RotateCcw size={14} /> Wyczyść
          </button>

          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={() => downloadImage("png")}
              style={{ ...btnStyle(false), fontSize: 11, padding: "4px 8px" }}
              title="Pobierz PNG"
            >
              <Download size={13} /> PNG
            </button>
            <button
              type="button"
              onClick={() => downloadImage("jpeg")}
              style={{ ...btnStyle(false), fontSize: 11, padding: "4px 8px" }}
              title="Pobierz JPG"
            >
              <Download size={13} /> JPG
            </button>
          </div>
        </div>
      </div>

      {/* KONTENER CANVAS */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          flex: 1,
          minHeight: 450,
          position: "relative",
          background: "#0d1117",
          border: "2px dashed #30363d",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            cursor:
              mode === "profile_add"
                ? "crosshair"
                : mode === "profile_select"
                ? "pointer"
                : mode === "profile_color"
                ? "cell"
                : "crosshair",
            background: "#ffffff",
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      {/* MODAL EDYCJI NAZWY I WYMIARU W MM */}
      {editingSegmentIndex !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              padding: 20,
              width: 340,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 8 }}>
              <Type size={16} style={{ color: "#60a5fa" }} /> Edycja Wymiaru Segmentu
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600 }}>Etykieta litery (np. A, B, C):</label>
              <input
                type="text"
                autoFocus
                value={editingLabelValue}
                onChange={(e) => setEditingLabelValue(e.target.value)}
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#f0f6fc",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600 }}>Długość w milimetrach (mm):</label>
              <input
                type="text"
                value={editingLengthMmValue}
                onChange={(e) => setEditingLengthMmValue(e.target.value)}
                placeholder="np. 70 lub 1.5"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveSegmentEdit();
                  if (e.key === "Escape") setEditingSegmentIndex(null);
                }}
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#f0f6fc",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setEditingSegmentIndex(null)}
                style={{
                  background: "#21262d",
                  border: "1px solid #30363d",
                  color: "#c9d1d9",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={saveSegmentEdit}
                style={{
                  background: "#238636",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  borderRadius: 6,
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDYCJI KĄTA GIĘCIA */}
      {editingAngleIndex !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              padding: 20,
              width: 320,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 8 }}>
              <CornerDownRight size={16} style={{ color: "#60a5fa" }} /> Edycja Kąta Gięcia
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8b949e", fontWeight: 600 }}>Wartość kąta (np. 90°, 135°, 45°):</label>
              <input
                type="text"
                autoFocus
                value={editingAngleValue}
                onChange={(e) => setEditingAngleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveAngleEdit();
                  if (e.key === "Escape") setEditingAngleIndex(null);
                }}
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#f0f6fc",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setEditingAngleIndex(null)}
                style={{
                  background: "#21262d",
                  border: "1px solid #30363d",
                  color: "#c9d1d9",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={saveAngleEdit}
                style={{
                  background: "#238636",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  borderRadius: 6,
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STOPKA I INSTRUKCJA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <div style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center", gap: 12 }}>
          <span>💡 <b>Shift</b>: Blokowanie kątów (0°, 45°, 90°).</span>
          <span>🖱️ <b>Kliknij na etykietę wymiaru lub kąt</b>: Zmień wartość (mm / °).</span>
        </div>
        <button
          type="button"
          onClick={handleApplyDrawing}
          style={{
            background: "#238636",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 24px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 8px rgba(35, 134, 54, 0.2)",
          }}
        >
          <Check size={16} /> Zatwierdź Szkic
        </button>
      </div>
    </div>
  );
}
