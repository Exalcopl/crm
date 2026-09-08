import re

with open("app/admin/panel/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace archive button in PanelTaskCard
old_panel_btn = '''        {!isOverlay && (
          <button
            type="button"
            className="quote-detail-task-card-remove"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void archiveTask({ id: task._id })}
            aria-label="Archiwizuj zadanie"
            title="Archiwizuj zadanie"
          >
            <I.archive s={12} />
          </button>
        )}'''

new_panel_btn = '''        {!isOverlay && task.status === "done" && (
          <button
            type="button"
            style={{ marginLeft: "auto", background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", cursor: "pointer", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void archiveTask({ id: task._id })}
            aria-label="Archiwizuj zadanie natychmiast"
            title="Archiwizuj zadanie"
          >
            <I.archive s={12} />
            Archiwizuj
          </button>
        )}'''

content = content.replace(old_panel_btn, new_panel_btn)

# Add archiveTask mutation to PreProdTaskCard
content = content.replace(
    '  const assignTask = useMutation(api.orderPreProdSteps.setAssigneeIds);',
    '''  const assignTask = useMutation(api.orderPreProdSteps.setAssigneeIds);
  const archiveTask = useMutation(api.orderPreProdSteps.archive);'''
)

# Add archive button to PreProdTaskCard
# First find the footer of PreProdTaskCard. It ends around line 865
# We can find DueDatePicker in PreProdTaskCard and append the button

old_preprod_footer = '''      <div className="kanban-card-footer" style={{ marginTop: "8px", alignItems: "center" }}>
        <div onPointerDown={(e) => e.stopPropagation()}>
          <DueDatePicker
            dueDate={step.endDate}
            tone={tone}
            disabled={isOverlay}
            onChange={(d) =>
              void updateDates({ id: step._id as Id<"orderPreProdSteps">, startDate: step.startDate ?? null, endDate: d ?? null })
            }
          />
        </div>
      </div>'''

new_preprod_footer = '''      <div className="kanban-card-footer" style={{ marginTop: "8px", alignItems: "center" }}>
        <div onPointerDown={(e) => e.stopPropagation()}>
          <DueDatePicker
            dueDate={step.endDate}
            tone={tone}
            disabled={isOverlay}
            onChange={(d) =>
              void updateDates({ id: step._id as Id<"orderPreProdSteps">, startDate: step.startDate ?? null, endDate: d ?? null })
            }
          />
        </div>

        {!isOverlay && (step.status === "done" || step.done) && (
          <button
            type="button"
            style={{ marginLeft: "auto", background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", cursor: "pointer", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void archiveTask({ id: step._id as Id<"orderPreProdSteps"> })}
            aria-label="Archiwizuj zadanie natychmiast"
            title="Archiwizuj zadanie"
          >
            <I.archive s={12} />
            Archiwizuj
          </button>
        )}
      </div>'''

content = content.replace(old_preprod_footer, new_preprod_footer)

with open("app/admin/panel/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

