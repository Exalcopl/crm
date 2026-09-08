import re

with open("app/admin/_components/order-pre-prod-gantt.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update DragState
old_drag_state = '''type DragState = {
  type: "move" | "resize-start" | "resize-end";
  stepId: Id<"orderPreProdSteps">;
  startX: number;
  initialStart: string;
  initialEnd: string;
};'''
new_drag_state = '''type DragState = {
  type: "move" | "resize-start" | "resize-end";
  stepId: Id<"orderPreProdSteps">;
  startX: number;
  currentX: number;
  initialStart: string;
  initialEnd: string;
};'''
content = content.replace(old_drag_state, new_drag_state)

# 2. handleBarMouseDown
old_mousedown = '''  const handleBarMouseDown = useCallback((e: React.MouseEvent, type: DragState["type"], step: Step) => {
    e.preventDefault();
    const dates = localDates[step._id];
    if (!dates) return;
    setDrag({ type, stepId: step._id, startX: e.clientX, initialStart: dates.start, initialEnd: dates.end });
  }, [localDates]);'''
new_mousedown = '''  const handleBarMouseDown = useCallback((e: React.MouseEvent, type: DragState["type"], step: Step) => {
    e.preventDefault();
    const dates = localDates[step._id];
    if (!dates) return;
    setDrag({ type, stepId: step._id, startX: e.clientX, currentX: e.clientX, initialStart: dates.start, initialEnd: dates.end });
  }, [localDates]);'''
content = content.replace(old_mousedown, new_mousedown)

# 3. useEffect
old_useeffect = '''  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - drag.startX) / DAY_WIDTH);
      let ns = drag.initialStart, ne = drag.initialEnd;
      if (drag.type === "move") { ns = addDays(drag.initialStart, delta); ne = addDays(drag.initialEnd, delta); }
      else if (drag.type === "resize-start") { ns = addDays(drag.initialStart, delta); if (ns > ne) ns = ne; }
      else { ne = addDays(drag.initialEnd, delta); if (ne < ns) ne = ns; }
      setLocalDates(prev => ({ ...prev, [drag.stepId]: { start: ns, end: ne } }));
    };
    const onUp = async () => {
      const final = localDates[drag.stepId];
      const sid = drag.stepId;
      setMutatingId(sid); setDrag(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (final && (final.start !== drag.initialStart || final.end !== drag.initialEnd)) {
        try { await updateDates({ id: sid, startDate: final.start, endDate: final.end }); }
        catch { setLocalDates(prev => ({ ...prev, [sid]: { start: drag.initialStart, end: drag.initialEnd } })); toast.error("Błąd aktualizacji dat"); }
        finally { setMutatingId(null); }
      } else { setMutatingId(null); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, localDates, updateDates]);'''

new_useeffect = '''  useEffect(() => {
    if (!drag) return;
    
    const initialDrag = drag;
    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - initialDrag.startX) / DAY_WIDTH);
      let ns = initialDrag.initialStart, ne = initialDrag.initialEnd;
      if (initialDrag.type === "move") { ns = addDays(initialDrag.initialStart, delta); ne = addDays(initialDrag.initialEnd, delta); }
      else if (initialDrag.type === "resize-start") { ns = addDays(initialDrag.initialStart, delta); if (ns > ne) ns = ne; }
      else { ne = addDays(initialDrag.initialEnd, delta); if (ne < ns) ne = ns; }
      
      setDrag(prev => prev ? { ...prev, currentX: e.clientX } : null);
      setLocalDates(prev => ({ ...prev, [initialDrag.stepId]: { start: ns, end: ne } }));
    };
    
    const onUp = () => {
      setDrag(prev => {
        if (!prev) return null;
        const finalDelta = Math.round((prev.currentX - prev.startX) / DAY_WIDTH);
        let ns = prev.initialStart, ne = prev.initialEnd;
        if (prev.type === "move") { ns = addDays(prev.initialStart, finalDelta); ne = addDays(prev.initialEnd, finalDelta); }
        else if (prev.type === "resize-start") { ns = addDays(prev.initialStart, finalDelta); if (ns > ne) ns = ne; }
        else { ne = addDays(prev.initialEnd, finalDelta); if (ne < ns) ne = ns; }
        
        if (ns !== prev.initialStart || ne !== prev.initialEnd) {
           setMutatingId(prev.stepId);
           updateDates({ id: prev.stepId, startDate: ns, endDate: ne })
             .catch(() => {
               toast.error("Błąd aktualizacji dat");
               setLocalDates(l => ({ ...l, [prev.stepId]: { start: prev.initialStart, end: prev.initialEnd } }));
             })
             .finally(() => setMutatingId(null));
        }
        return null;
      });
    };
    
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.stepId]);'''
content = content.replace(old_useeffect, new_useeffect)

# 4. getBarRect
old_getbarrect = '''  function getBarRect(stepId: Id<"orderPreProdSteps">, rowIdx: number) {
    const dates = localDates[stepId];
    if (!dates) return null;
    const startIdx = days.findIndex(d => d.dateStr === dates.start);
    const endIdx = days.findIndex(d => d.dateStr === dates.end);
    if (startIdx === -1) return null;
    const ei = endIdx === -1 ? startIdx : endIdx;
    return {
      left: startIdx * DAY_WIDTH + 3,
      right: (ei + 1) * DAY_WIDTH - 3,
      centerY: rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
    };
  }'''
new_getbarrect = '''  function getBarRect(stepId: Id<"orderPreProdSteps">, rowIdx: number) {
    const dates = localDates[stepId];
    if (!dates) return null;
    const startIdx = days.findIndex(d => d.dateStr === dates.start);
    const endIdx = days.findIndex(d => d.dateStr === dates.end);
    if (startIdx === -1) return null;
    const ei = endIdx === -1 ? startIdx : endIdx;

    let left = startIdx * DAY_WIDTH + 3;
    let right = (ei + 1) * DAY_WIDTH - 3;

    if (drag && drag.stepId === stepId) {
       const pixelDelta = drag.currentX - drag.startX;
       const deltaDays = Math.round(pixelDelta / DAY_WIDTH);
       const smoothOffset = pixelDelta - (deltaDays * DAY_WIDTH);

       if (drag.type === "move") {
         left += smoothOffset;
         right += smoothOffset;
       } else if (drag.type === "resize-start") {
         left += smoothOffset;
       } else if (drag.type === "resize-end") {
         right += smoothOffset;
       }
    }

    return {
      left,
      right,
      centerY: rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
    };
  }'''
content = content.replace(old_getbarrect, new_getbarrect)

# 5. Render loop barLeft / barWidth
old_render_bar = '''                  let barLeft = 0, barWidth = 0;
                  if (dates) {
                    const si = days.findIndex(d => d.dateStr === dates.start);
                    const ei = days.findIndex(d => d.dateStr === dates.end);
                    if (si !== -1) {
                      barLeft = si * DAY_WIDTH + 3;
                      barWidth = ((ei !== -1 ? ei : si) - si + 1) * DAY_WIDTH - 6;
                    }
                  }'''
new_render_bar = '''                  let barLeft = 0, barWidth = 0;
                  if (dates) {
                    const si = days.findIndex(d => d.dateStr === dates.start);
                    const ei = days.findIndex(d => d.dateStr === dates.end);
                    if (si !== -1) {
                      barLeft = si * DAY_WIDTH + 3;
                      let right = ((ei !== -1 ? ei : si) + 1) * DAY_WIDTH - 3;

                      if (drag && drag.stepId === step._id) {
                         const pixelDelta = drag.currentX - drag.startX;
                         const deltaDays = Math.round(pixelDelta / DAY_WIDTH);
                         const smoothOffset = pixelDelta - (deltaDays * DAY_WIDTH);

                         if (drag.type === "move") {
                           barLeft += smoothOffset;
                           right += smoothOffset;
                         } else if (drag.type === "resize-start") {
                           barLeft += smoothOffset;
                         } else if (drag.type === "resize-end") {
                           right += smoothOffset;
                         }
                      }
                      barWidth = right - barLeft;
                    }
                  }'''
content = content.replace(old_render_bar, new_render_bar)

with open("app/admin/_components/order-pre-prod-gantt.tsx", "w", encoding="utf-8") as f:
    f.write(content)

