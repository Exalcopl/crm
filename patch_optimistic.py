import re

with open("app/admin/panel/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add optimistic state
content = content.replace(
    'const [activeTask, setActiveTask] = useState<TaskWithQuote | PreProdStep | null>(null);',
    '''const [activeTask, setActiveTask] = useState<TaskWithQuote | PreProdStep | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, TaskStatus>>({});
  
  useEffect(() => {
    setOptimistic(prev => {
      let changed = false;
      const next = { ...prev };
      for (const t of (tasksRaw ?? []) as TaskWithQuote[]) {
        if (next[t._id as string] === t.status) {
          delete next[t._id as string];
          changed = true;
        }
      }
      for (const s of (preProdRaw ?? []) as PreProdStep[]) {
        const st = s.status || (s.done ? "done" : "todo");
        if (next[s._id] === st) {
          delete next[s._id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasksRaw, preProdRaw]);'''
)

# Update byColumn
content = re.sub(
    r'  const byColumn = useMemo\(\(\) => \{.*?\n  \}, \[filteredTasks\]\);',
    r'''  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, TaskWithQuote[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of filteredTasks) {
      const st = optimistic[t._id as string] || t.status;
      if (map[st]) map[st].push(t);
    }
    return map;
  }, [filteredTasks, optimistic]);''',
    content,
    flags=re.DOTALL
)

# Update preProdByColumn
content = re.sub(
    r'  const preProdByColumn = useMemo\(\(\) => \{.*?\n  \}, \[filteredPreProd\]\);',
    r'''  const preProdByColumn = useMemo(() => {
    const map: Record<TaskStatus, PreProdStep[]> = { todo: [], in_progress: [], done: [] };
    for (const s of filteredPreProd) {
      const st = optimistic[s._id] || s.status || (s.done ? "done" : "todo");
      if (map[st as TaskStatus]) map[st as TaskStatus].push(s);
    }
    return map;
  }, [filteredPreProd, optimistic]);''',
    content,
    flags=re.DOTALL
)

# Update handleDragEnd
content = re.sub(
    r'  function handleDragEnd\(e: DragEndEvent\) \{.*?\n  \}',
    r'''  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    if (!e.over) return;
    const taskId = e.active.id as string;
    const newStatus = e.over.id as TaskStatus;
    const task = tasks.find((t) => (t._id as unknown as string) === taskId);
    if (task) {
      if (task.status === newStatus) return;
      setOptimistic(p => ({ ...p, [taskId]: newStatus }));
      void setStatus({ id: taskId as Id<"tasks">, status: newStatus });
      return;
    }
    const preProd = filteredPreProd.find((t) => t._id === taskId);
    if (preProd) {
      const st = preProd.status || (preProd.done ? "done" : "todo");
      if (st === newStatus) return;
      setOptimistic(p => ({ ...p, [taskId]: newStatus }));
      void setPreProdStatus({ id: taskId as Id<"orderPreProdSteps">, status: newStatus });
    }
  }''',
    content,
    flags=re.DOTALL
)

with open("app/admin/panel/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
