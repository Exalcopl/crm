import re

with open("app/admin/panel/archiwum/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add useQuery for preProdSteps
content = content.replace(
    'const tasks = useQuery(api.tasks.listArchived);',
    '''const tasks = useQuery(api.tasks.listArchived);
  const preProdTasks = useQuery(api.orderPreProdSteps.listArchived);'''
)

# Update Loading condition
content = content.replace(
    'if (tasks === undefined || users === undefined || isLoading) {',
    'if (tasks === undefined || preProdTasks === undefined || users === undefined || isLoading) {'
)

# Combine and sort tasks
content = re.sub(
    r'  // Opcjonalne filtrowanie: jeśli zaznaczono kogoś, pokaż tylko przypisane do tych osób\n  const filteredTasks = selectedUserIds\.length > 0\n    \? tasks\.filter\(\(t: any\) => t\.assigneeIds\?\.some\(\(id: any\) => selectedUserIds\.includes\(id\)\)\)\n    : tasks;',
    r'''  const combinedTasks = [...tasks, ...preProdTasks].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  // Opcjonalne filtrowanie: jeśli zaznaczono kogoś, pokaż tylko przypisane do tych osób
  const filteredTasks = selectedUserIds.length > 0
    ? combinedTasks.filter((t: any) => t.assigneeIds?.some((id: any) => selectedUserIds.includes(id)))
    : combinedTasks;''',
    content,
    flags=re.DOTALL
)

# Update ArchivedTaskRow
new_cell = '''      <td>
        {task.quote ? (
          <Link
            href={`/admin/wyceny/${task.quote.code}`}
            className="panel-task-card-quote"
            title={`${task.quote.code} · ${task.quote.contactName}`}
          >
            <span className="panel-task-card-quote-code">🏷️ {task.quote.code}</span>
            <span className="panel-task-card-quote-sep">•</span>
            <span className="panel-task-card-quote-client">{task.quote.contactName}</span>
          </Link>
        ) : task.orderNumber ? (
          <Link
            href={`/admin/zlecenia/${task.orderId}`}
            className="panel-task-card-quote"
            title={`${task.orderNumber} · ${task.clientName}`}
          >
            <span className="panel-task-card-quote-code">⚙️ {task.orderNumber}</span>
            <span className="panel-task-card-quote-sep">•</span>
            <span className="panel-task-card-quote-client">{task.clientName}</span>
          </Link>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Zadanie wewnętrzne</span>
        )}
      </td>'''

content = re.sub(
    r'      <td>\n        \{task\.quote \?\s*\(.*?Zadanie wewnętrzne<\/span>\n        \)\}\n      <\/td>',
    new_cell,
    content,
    flags=re.DOTALL
)

with open("app/admin/panel/archiwum/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
