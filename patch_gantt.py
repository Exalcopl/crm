import re

with open("app/admin/_components/order-pre-prod-gantt.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update FlatRow type
content = content.replace(
    'type FlatRow = { step: Step; depth: 0 | 1; parentStep: Step | null };',
    'type FlatRow = { step: Step; depth: number; parentStep: Step | null };'
)

# 2. Update buildFlatRows
old_build_flat_rows = '''function buildFlatRows(steps: Step[], filterUserId: Id<"users"> | null): FlatRow[] {
  const parents = steps.filter(s => !s.parentId).sort((a, b) => a.order - b.order);
  const childrenOf = (parentId: Id<"orderPreProdSteps">) =>
    steps.filter(s => s.parentId === parentId).sort((a, b) => a.order - b.order);

  const result: FlatRow[] = [];
  for (const parent of parents) {
    const kids = childrenOf(parent._id);
    const kidsFiltered = filterUserId 
      ? kids.filter(c => getStepAssigneeIds(c).includes(filterUserId)) 
      : kids;
    const parentMatches = !filterUserId || getStepAssigneeIds(parent).includes(filterUserId);

    if (parentMatches || kidsFiltered.length > 0) {
      result.push({ step: parent, depth: 0, parentStep: null });
      for (const child of kidsFiltered) {
        result.push({ step: child, depth: 1, parentStep: parent });
      }
    }
  }
  return result;
}'''

new_build_flat_rows = '''function buildFlatRows(steps: Step[], filterUserId: Id<"users"> | null): FlatRow[] {
  const childrenOf = (parentId?: Id<"orderPreProdSteps">) =>
    steps.filter(s => s.parentId === parentId).sort((a, b) => a.order - b.order);

  const visibleSteps = new Set<string>();
  if (filterUserId) {
    function checkVisibility(kidId: Id<"orderPreProdSteps">): boolean {
      const kid = steps.find(s => s._id === kidId);
      if (!kid) return false;
      let isVisible = getStepAssigneeIds(kid).includes(filterUserId);
      const kidChildren = childrenOf(kidId);
      for (const c of kidChildren) {
        if (checkVisibility(c._id)) {
          isVisible = true;
        }
      }
      if (isVisible) visibleSteps.add(kidId);
      return isVisible;
    }
    const roots = childrenOf(undefined);
    for (const r of roots) {
      checkVisibility(r._id);
    }
  }

  const result: FlatRow[] = [];
  function traverseAndBuild(parentId: Id<"orderPreProdSteps"> | undefined, depth: number, parentStep: Step | null) {
    const kids = childrenOf(parentId);
    for (const kid of kids) {
      if (!filterUserId || visibleSteps.has(kid._id)) {
        result.push({ step: kid, depth, parentStep });
        traverseAndBuild(kid._id, depth + 1, kid);
      }
    }
  }

  traverseAndBuild(undefined, 0, null);
  return result;
}'''
content = content.replace(old_build_flat_rows, new_build_flat_rows)


# 3. Update Left Column UI (depth === 1 to depth > 0)
content = content.replace('const isSubtask = depth === 1;', 'const isSubtask = depth > 0;')

# 4. Update padding
content = content.replace(
    'padding: `0 12px 0 ${isSubtask ? 32 : 14}px`,',
    'padding: `0 12px 0 ${14 + depth * 18}px`,'
)

# 5. Update connector
old_connector = '''{isSubtask && (
                      <div style={{ position: "absolute", left: 14, top: 0, bottom: "50%", width: 10, borderLeft: "1px dashed rgba(255,255,255,0.4)", borderBottom: "1px dashed rgba(255,255,255,0.4)", borderBottomLeftRadius: 4 }} />
                    )}'''

new_connector = '''{isSubtask && (
                      <div style={{ position: "absolute", left: 14 + (depth - 1) * 18, top: 0, bottom: "50%", width: 10, borderLeft: "1px dashed rgba(255,255,255,0.4)", borderBottom: "1px dashed rgba(255,255,255,0.4)", borderBottomLeftRadius: 4 }} />
                    )}'''
content = content.replace(old_connector, new_connector)

# 6. Update Add subtask button
old_btn = '''                    {/* Add subtask button (only on top-level tasks) */}
                    {!isSubtask && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); activateAddRow(step._id); }}
                        title="Dodaj podzadanie"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = PRIMARY; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#374151"; }}>
                        <GitBranch size={12} />
                      </button>
                    )}'''

new_btn = '''                    {/* Add subtask button (available for all tasks) */}
                    <button type="button"
                      onClick={e => { e.stopPropagation(); activateAddRow(step._id); }}
                      title="Dodaj podzadanie"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = PRIMARY; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#374151"; }}>
                      <GitBranch size={12} />
                    </button>'''
content = content.replace(old_btn, new_btn)

with open("app/admin/_components/order-pre-prod-gantt.tsx", "w", encoding="utf-8") as f:
    f.write(content)

