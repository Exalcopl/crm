// Test weryfikacyjny dla logiki geometrycznej edytora CAD (obróbki blacharskie)
import assert from "node:assert";

console.log("=== Rozpoczynam weryfikację logiki geometrycznej CAD ===");

// 1. Pomocnicza funkcja odległości do odcinka
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// 2. Test zmiany wymiaru segmentu
function resizeSegment(nodes, idx, targetMm, scaleFactor = 1.0) {
  const p1 = nodes[idx];
  const p2 = nodes[idx + 1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const currentPx = Math.hypot(dx, dy);

  assert(currentPx > 0.001, "Długość segmentu musi być większa od zera");
  const targetPx = targetMm / scaleFactor;
  const ux = dx / currentPx;
  const uy = dy / currentPx;

  const newP2X = p1.x + ux * targetPx;
  const newP2Y = p1.y + uy * targetPx;

  const deltaX = newP2X - p2.x;
  const deltaY = newP2Y - p2.y;

  return nodes.map((node, nodeIdx) => {
    if (nodeIdx <= idx) return node;
    return {
      ...node,
      x: Math.round((node.x + deltaX) * 10) / 10,
      y: Math.round((node.y + deltaY) * 10) / 10,
    };
  });
}

// 3. Test zmiany kąta gięcia
function rotateAngle(nodes, idx, targetDeg) {
  const pPrev = nodes[idx - 1];
  const pCurr = nodes[idx];
  const pNext = nodes[idx + 1];

  const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
  const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

  const len1 = Math.hypot(v1.x, v1.y);
  const len2 = Math.hypot(v2.x, v2.y);
  assert(len1 > 0.001 && len2 > 0.001, "Ramiona kąta muszą mieć długość > 0");

  const a1 = Math.atan2(v1.y, v1.x);
  const a2 = Math.atan2(v2.y, v2.x);

  let currentDiff = a2 - a1;
  while (currentDiff < -Math.PI) currentDiff += Math.PI * 2;
  while (currentDiff > Math.PI) currentDiff -= Math.PI * 2;

  const currentSign = currentDiff >= 0 ? 1 : -1;
  const targetRad = (targetDeg * Math.PI) / 180;
  const targetDiff = currentSign * targetRad;

  const targetA2 = a1 + targetDiff;
  let deltaTheta = targetA2 - a2;
  while (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;
  while (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;

  const cosTheta = Math.cos(deltaTheta);
  const sinTheta = Math.sin(deltaTheta);

  return nodes.map((node, nodeIdx) => {
    if (nodeIdx <= idx) return node;
    const rx = node.x - pCurr.x;
    const ry = node.y - pCurr.y;
    return {
      ...node,
      x: Math.round((pCurr.x + rx * cosTheta - ry * sinTheta) * 10) / 10,
      y: Math.round((pCurr.y + rx * sinTheta + ry * cosTheta) * 10) / 10,
    };
  });
}

function calculateAngleDeg(pPrev, pCurr, pNext) {
  const a1 = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
  const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
  let diff = a2 - a1;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return Math.round((Math.abs(diff) * 180) / Math.PI);
}

// TEST 1: Zmiana długości segmentu
console.log("Test 1: Skalowanie segmentu...");
const initialNodes = [
  { id: "1", x: 100, y: 100 },
  { id: "2", x: 200, y: 100 }, // segment 0: len = 100
  { id: "3", x: 200, y: 250 }, // segment 1: len = 150
];

const resized = resizeSegment(initialNodes, 0, 150, 1.0);
const lenSeg0 = Math.hypot(resized[1].x - resized[0].x, resized[1].y - resized[0].y);
const lenSeg1 = Math.hypot(resized[2].x - resized[1].x, resized[2].y - resized[1].y);
assert.strictEqual(Math.round(lenSeg0), 150, "Segment 0 powinien mieć dokładnie 150mm");
assert.strictEqual(Math.round(lenSeg1), 150, "Segment 1 powinien zachować swoją długość 150mm");
console.log("✅ Test 1 zdany: Segment 0 rozciągnięty do 150mm, segment 1 zachował długość.");

// TEST 2: Zmiana kąta gięcia
console.log("Test 2: Obrót kąta gięcia...");
const angleBefore = calculateAngleDeg(resized[0], resized[1], resized[2]);
assert.strictEqual(angleBefore, 90, "Początkowy kąt powinien wynosić 90°");

const rotated = rotateAngle(resized, 1, 135);
const angleAfter = calculateAngleDeg(rotated[0], rotated[1], rotated[2]);
assert.strictEqual(angleAfter, 135, "Kąt po obrocie powinien wynosić dokładnie 135°");

const lenSeg1AfterRotation = Math.hypot(rotated[2].x - rotated[1].x, rotated[2].y - rotated[1].y);
assert.strictEqual(Math.round(lenSeg1AfterRotation), 150, "Długość segmentu po obrocie kąta nie uległa zmianie");
console.log("✅ Test 2 zdany: Kąt zmieniony z 90° na 135°, długość ramienia zachowana.");

// TEST 3: Hit-testing wymiarów i etykiet
console.log("Test 3: Detekcja kliknięć (Hit-testing)...");
const p1 = { x: 100, y: 100 };
const p2 = { x: 200, y: 100 };
const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const pxLen = Math.hypot(dx, dy);
const nx = -dy / pxLen;
const ny = dx / pxLen;
const offset = 34;
const dimMidX = (p1.x + p2.x) / 2 + nx * offset; // 150 + 0 = 150
const dimMidY = (p1.y + p2.y) / 2 + ny * offset; // 100 + 34 = 134

// Kliknięcie dokładnie w środek etykiety wymiaru:
const clickOnBadge = { x: 150, y: 134 };
const hitBadge = Math.hypot(dimMidX - clickOnBadge.x, dimMidY - clickOnBadge.y) <= 30;
assert.strictEqual(hitBadge, true, "Kliknięcie w środek etykiety wymiaru powinno być wykryte");

// Kliknięcie lekko obok etykiety (np. 15px w prawo):
const clickNearBadge = { x: 165, y: 134 };
const hitNearBadge = Math.hypot(dimMidX - clickNearBadge.x, dimMidY - clickNearBadge.y) <= 30;
assert.strictEqual(hitNearBadge, true, "Kliknięcie w obszarze etykiety powinno być wykryte");

// Kliknięcie w linię pomocniczą / odcinek profilu:
const clickOnSeg = { x: 150, y: 100 };
const hitSeg = distToSegment(clickOnSeg.x, clickOnSeg.y, p1.x, p1.y, p2.x, p2.y) <= 10;
assert.strictEqual(hitSeg, true, "Kliknięcie w odcinek profilu powinno być wykryte");

console.log("✅ Test 3 zdany: Kliknięcia w etykietę, obszar wymiaru i odcinek są poprawnie wykrywane.");

// TEST 4: Zoom w stronę kursora (Zoom to cursor)
console.log("Test 4: Przeliczenie zoomu wokół kursora...");
const cursorScreen = { x: 400, y: 250 };
let currentZoom = 1.0;
let currentPan = { x: 0, y: 0 };

// Punkt w świecie CAD pod kursorem przed zoomem
const worldUnderCursor = {
  x: (cursorScreen.x - currentPan.x) / currentZoom,
  y: (cursorScreen.y - currentPan.y) / currentZoom,
};

// Zmiana zoomu na 1.5x
const nextZoom = 1.5;
const nextPan = {
  x: Math.round(cursorScreen.x - worldUnderCursor.x * nextZoom),
  y: Math.round(cursorScreen.y - worldUnderCursor.y * nextZoom),
};

// Sprawdź czy po zoomie ten sam punkt w świecie nadal wyświetla się dokładnie pod kursorem
const screenAfterZoom = {
  x: worldUnderCursor.x * nextZoom + nextPan.x,
  y: worldUnderCursor.y * nextZoom + nextPan.y,
};

assert.strictEqual(screenAfterZoom.x, cursorScreen.x, "Współrzędna X pod kursorem musi pozostać niezmienna po zoomie");
assert.strictEqual(screenAfterZoom.y, cursorScreen.y, "Współrzędna Y pod kursorem musi pozostać niezmienna po zoomie");
console.log("✅ Test 4 zdany: Zoom wokół kursora precyzyjnie zachowuje pozycję punktu pod kursorem.");

console.log("=== Wszystkie testy geometrii CAD i zoomu zakończone sukcesem! ===");
