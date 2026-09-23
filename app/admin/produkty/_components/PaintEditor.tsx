"use client";

import React, { useRef, useState, useEffect } from "react";
import { Download, Eraser, Pen, Minus, CircleDashed, Square, Check, Spline } from "lucide-react";

type Tool = "freehand" | "line" | "rounded-rect" | "arc" | "spline";

interface PaintEditorProps {
  onApply: (file: File) => void;
}

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

export function PaintEditor({ onApply }: PaintEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("freehand");
  const [color, setColor] = useState("#000000"); // Default black ink on white paper
  const [lineWidth, setLineWidth] = useState(3);
  const [cornerRadius, setCornerRadius] = useState(20);

  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshot = useRef<ImageData | null>(null);
  const hasDrawn = useRef(false);

  // Spline state
  const splinePointsRef = useRef<{ x: number; y: number }[]>([]);

  // Resize observer to handle dynamic canvas size
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // We only resize if canvas internal size doesn't match container width
        if (canvas.width !== width || canvas.height !== height) {
          // Save existing drawing before resize
          const ctx = canvas.getContext("2d");
          let existingData: ImageData | null = null;
          if (ctx && canvas.width > 0 && canvas.height > 0 && hasDrawn.current) {
            existingData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          if (ctx) {
            // Re-fill white background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Restore drawing
            if (existingData) {
              ctx.putImageData(existingData, 0, 0);
            }
          }
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);

    hasDrawn.current = true;

    if (tool === "spline") {
      if (splinePointsRef.current.length === 0) {
        snapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setIsDrawing(true);
      }
      splinePointsRef.current.push(pos);
      return;
    }

    startPos.current = pos;
    setIsDrawing(true);

    snapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (tool === "freehand") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && !(tool === "spline" && splinePointsRef.current.length > 0)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let currentPos = getPos(e);

    if (e.shiftKey) {
      if (tool === "line") {
        currentPos = snapToOrtho(startPos.current, currentPos);
      } else if (tool === "spline" && splinePointsRef.current.length > 0) {
        currentPos = snapToOrtho(splinePointsRef.current[splinePointsRef.current.length - 1], currentPos);
      } else if (tool === "rounded-rect") {
        const dx = currentPos.x - startPos.current.x;
        const dy = currentPos.y - startPos.current.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        currentPos = {
          x: startPos.current.x + (dx >= 0 ? size : -size),
          y: startPos.current.y + (dy >= 0 ? size : -size),
        };
      }
    }

    if (tool !== "freehand" && snapshot.current) {
      ctx.putImageData(snapshot.current, 0, 0);
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "spline") {
      if (splinePointsRef.current.length > 0) {
        const pts = [...splinePointsRef.current, currentPos];
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
          ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          for (let i = 1; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) / 2;
            const yc = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        }
        ctx.stroke();
      }
      return;
    }

    if (tool === "freehand") {
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
    } else if (tool === "line") {
      ctx.beginPath();
      ctx.moveTo(startPos.current.x, startPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
    } else if (tool === "rounded-rect") {
      const x = Math.min(startPos.current.x, currentPos.x);
      const y = Math.min(startPos.current.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.current.x);
      const h = Math.abs(currentPos.y - startPos.current.y);

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, cornerRadius);
      ctx.stroke();
    } else if (tool === "arc") {
      ctx.beginPath();
      const midX = (startPos.current.x + currentPos.x) / 2;
      const midY = startPos.current.y;

      ctx.moveTo(startPos.current.x, startPos.current.y);
      ctx.arcTo(midX, midY, currentPos.x, currentPos.y, cornerRadius * 2);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "spline") {
      // Don't stop drawing for spline on mouseup
      return;
    }
    setIsDrawing(false);
  };

  const finishSpline = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (tool === "spline" && splinePointsRef.current.length > 0) {
      splinePointsRef.current = [];
      setIsDrawing(false);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) snapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  };

  const downloadImage = (format: "png" | "jpeg") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const image = canvas.toDataURL(mimeType, 0.95);
    const link = document.createElement("a");
    link.href = image;
    link.download = `szkic-${Date.now()}.${format}`;
    link.click();
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `szkic-${Date.now()}.webp`, { type: "image/webp" });
      onApply(file);
    }, "image/webp", 0.9);
  };

  const btnStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? "rgba(96, 165, 250, 0.15)" : "transparent",
    border: isActive ? "1px solid rgba(96, 165, 250, 0.4)" : "1px solid #30363d",
    color: isActive ? "#60a5fa" : "#c9d1d9",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    transition: "all 120ms ease",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, background: "#161b22", padding: 12, borderRadius: 8, border: "1px solid #30363d", alignItems: "center" }}>
        
        <button type="button" onClick={() => setTool("freehand")} style={btnStyle(tool === "freehand")}>
          <Pen size={14} /> Ołówek
        </button>
        <button type="button" onClick={() => setTool("line")} style={btnStyle(tool === "line")}>
          <Minus size={14} /> Linia
        </button>
        <button type="button" onClick={() => { setTool("arc"); finishSpline(); }} style={btnStyle(tool === "arc")}>
          <CircleDashed size={14} /> Łuk
        </button>
        <button type="button" onClick={() => { setTool("spline"); finishSpline(); }} style={btnStyle(tool === "spline")}>
          <Spline size={14} /> Ścieżka (Splajn)
        </button>
        <button type="button" onClick={() => { setTool("rounded-rect"); finishSpline(); }} style={btnStyle(tool === "rounded-rect")}>
          <Square size={14} /> Prostokąt
        </button>

        <span style={{ borderLeft: "1px solid #30363d", height: 20, margin: "0 4px" }} />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8b949e", fontWeight: 600 }}>
          Kolor:
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            style={{ width: 24, height: 24, padding: 0, border: "none", borderRadius: 4, background: "transparent", cursor: "pointer" }} 
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8b949e", fontWeight: 600, marginLeft: 8 }}>
          Grubość: 
          <input 
            type="range" 
            min="1" max="20" 
            value={lineWidth} 
            onChange={(e) => setLineWidth(Number(e.target.value))} 
            style={{ width: 60, accentColor: "#60a5fa" }}
          />
        </label>

        <span style={{ borderLeft: "1px solid #30363d", height: 20, margin: "0 4px" }} />

        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button type="button" onClick={clearCanvas} style={{ ...btnStyle(false), color: "#f85149", borderColor: "rgba(248,81,73,0.3)" }}>
            <Eraser size={14} /> Wyczyść
          </button>
          
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" onClick={() => downloadImage("png")} style={{ ...btnStyle(false), fontSize: 11, padding: "4px 8px" }} title="Pobierz PNG">
              <Download size={13} /> PNG
            </button>
            <button type="button" onClick={() => downloadImage("jpeg")} style={{ ...btnStyle(false), fontSize: 11, padding: "4px 8px" }} title="Pobierz JPG">
              <Download size={13} /> JPG
            </button>
          </div>
        </div>
      </div>

      {/* Kontener na canvas */}
      <div 
        ref={containerRef} 
        style={{ 
          width: "100%", 
          flex: 1, 
          minHeight: 400, 
          position: "relative",
          background: "#0d1117",
          border: "2px dashed #30363d",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            cursor: "crosshair",
            background: "#ffffff",
            touchAction: "none"
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onDoubleClick={finishSpline}
          onContextMenu={finishSpline}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center" }}>
          💡 Przytrzymaj klawisz <b>&nbsp;Shift&nbsp;</b> podczas rysowania, aby blokować kąty proste i tworzyć równe kształty (tryb Ortho).
        </div>
        <button
          type="button"
          onClick={handleApply}
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
            boxShadow: "0 2px 8px rgba(35, 134, 54, 0.2)"
          }}
        >
          <Check size={16} /> Zatwierdź Szkic
        </button>
      </div>
    </div>
  );
}
