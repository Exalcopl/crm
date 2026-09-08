import re

with open("app/admin/panel/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update PreProdStep type
content = re.sub(
    r'  done: boolean;\n  endDate\?: string;',
    r'  done: boolean;\n  status?: "todo" | "in_progress" | "done";\n  endDate?: string;',
    content
)

# 2. Add mutation
content = content.replace(
    'const setStatus = useMutation(api.tasks.updateStatus);',
    'const setStatus = useMutation(api.tasks.updateStatus);\n  const setPreProdStatus = useMutation(api.orderPreProdSteps.updateStatus);'
)

# 3. Update preProdByColumn
content = re.sub(
    r'  const preProdByColumn = useMemo\(\(\) => \{\n    const map: Record<"todo" \| "done", PreProdStep\[\]> = \{ todo: \[\], done: \[\] \};\n    for \(const s of filteredPreProd\) \{\n      if \(s\.done\) map\.done\.push\(s\);\n      else map\.todo\.push\(s\);\n    \}\n    return map;\n  \}, \[filteredPreProd\]\);',
    r'''  const preProdByColumn = useMemo(() => {
    const map: Record<TaskStatus, PreProdStep[]> = { todo: [], in_progress: [], done: [] };
    for (const s of filteredPreProd) {
      const st = s.status || (s.done ? "done" : "todo");
      if (map[st as TaskStatus]) map[st as TaskStatus].push(s);
    }
    return map;
  }, [filteredPreProd]);''',
    content
)

# 4. Update handleDragEnd
content = re.sub(
    r'  function handleDragEnd\(e: DragEndEvent\) \{\n    setActiveTask\(null\);\n    if \(!e\.over\) return;\n    const taskId = e\.active\.id as Id<"tasks">;\n    const newStatus = e\.over\.id as TaskStatus;\n    const task = tasks\.find\(\n      \(t\) => \(t\._id as unknown as string\) === \(taskId as unknown as string\),\n    \);\n    if \(!task \|\| task\.status === newStatus\) return;\n    void setStatus\(\{ id: taskId, status: newStatus \}\);\n  \}',
    r'''  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    if (!e.over) return;
    const taskId = e.active.id as string;
    const newStatus = e.over.id as TaskStatus;
    const task = tasks.find((t) => (t._id as unknown as string) === taskId);
    if (task) {
      if (task.status === newStatus) return;
      void setStatus({ id: taskId as Id<"tasks">, status: newStatus });
      return;
    }
    const preProd = filteredPreProd.find((t) => t._id === taskId);
    if (preProd) {
      const st = preProd.status || (preProd.done ? "done" : "todo");
      if (st === newStatus) return;
      void setPreProdStatus({ id: taskId as Id<"orderPreProdSteps">, status: newStatus });
    }
  }''',
    content
)

# 5. Update PanelKanbanColumn usage
content = content.replace(
    'preProdSteps={col.id === "in_progress" ? [] : preProdByColumn[col.id as "todo" | "done"]}',
    'preProdSteps={preProdByColumn[col.id]}'
)

# 6. Update PanelKanbanColumn PreProdCard render
content = content.replace(
    '<PreProdTaskCard key={s._id} step={s} />',
    '<PreProdTaskCard key={s._id} step={s} assignees={assignees} />'
)

# 7. Update PreProdTaskCard definition
content = re.sub(
    r'function PreProdTaskCard\(\{ step \}: \{ step: PreProdStep \}\) \{.*',
    r'''function PreProdTaskCard({ step, assignees }: { step: PreProdStep; assignees: AssignableUser[] }) {
  const router = useRouter();
  const updateTitle = useMutation(api.orderPreProdSteps.updateTitle);
  const updateDates = useMutation(api.orderPreProdSteps.updateDates);
  const assignTask = useMutation(api.orderPreProdSteps.setAssigneeIds);
  const [editing, setEditing] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: step._id,
  });

  const draggable = !editing;
  const tone = dueTone(step.endDate);
  const toneColor =
    step.status === "done" || step.done
      ? "#3fb950"
      : tone === "overdue"
      ? "#f85149"
      : tone === "soon"
      ? "#d29922"
      : "#8b949e";

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card panel-task-card${isDragging ? " is-dragging" : ""}${draggable ? " is-draggable" : ""}`}
      style={{ opacity: isDragging ? 0 : (step.done || step.status === "done" ? 0.65 : 1) }}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div
        className="kanban-card-rail"
        style={{
          background: `linear-gradient(90deg, ${toneColor}, transparent)`,
          opacity: 0.8,
        }}
      />
      <div className="kanban-card-head" style={{ flexWrap: "wrap", gap: "6px" }}>
        {editing ? (
          <input
            type="text"
            defaultValue={step.title}
            autoFocus
            onBlur={(e) => {
              const v = e.target.value.trim();
              setEditing(false);
              if (v && v !== step.title) void updateTitle({ id: step._id as Id<"orderPreProdSteps">, title: v });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="quote-detail-task-card-title-input"
            style={{ flex: 1, minWidth: "120px" }}
          />
        ) : (
          <button
            type="button"
            className="kanban-card-id"
            style={{ background: "none", border: "none", cursor: "text", padding: 0, flex: 1, textAlign: "left", whiteSpace: "normal", color: step.done || step.status === "done" ? "var(--fg-muted)" : "var(--fg)", textDecoration: step.done || step.status === "done" ? "line-through" : "none" }}
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {step.done || step.status === "done" ? "✓ " : ""}
            {step.title}
          </button>
        )}

        <Link
          href={`/admin/zlecenia/${step.orderId}`}
          style={{
            fontSize: "9px",
            fontWeight: "bold",
            textTransform: "uppercase",
            color: "#d41d3c",
            background: "rgba(212, 29, 60, 0.1)",
            border: "1px solid rgba(212, 29, 60, 0.2)",
            padding: "1px 6px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "120px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            textDecoration: "none"
          }}
          title={`${step.orderNumber} · ${step.clientName}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          🏷️ {step.orderNumber}
        </Link>

        <div className="kanban-card-owner" onPointerDown={(e) => e.stopPropagation()}>
          <AssigneePicker
            assignees={assignees}
            currentIds={(step.assigneeId ? [step.assigneeId] : step.assigneeIds || []) as Id<"users">[]}
            onAssign={(userIds) =>
              void assignTask({ id: step._id as Id<"orderPreProdSteps">, assigneeIds: userIds })
            }
          />
        </div>
      </div>

      <div className="kanban-card-client" style={{ marginTop: "4px" }}>
        {step.clientName}
      </div>

      <div className="kanban-card-footer" style={{ marginTop: "8px", alignItems: "center" }}>
        <div onPointerDown={(e) => e.stopPropagation()}>
          <DueDatePicker
            dueDate={step.endDate}
            tone={tone}
            onChange={(d) =>
              void updateDates({ id: step._id as Id<"orderPreProdSteps">, endDate: d ?? null, startDate: null })
            }
          />
        </div>
      </div>
    </div>
  );
}''',
    content,
    flags=re.DOTALL
)

with open("app/admin/panel/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
