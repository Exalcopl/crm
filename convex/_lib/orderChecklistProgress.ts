export interface OrderChecklistProgress {
  done: number;
  total: number;
}

/**
 * Oblicza łączny postęp zadań z „List zadań i weryfikacji” dla każdego zlecenia.
 * Zlicza wyłącznie aktywne podzadania osiągalne z aktywnych kroków głównych (!parentId),
 * co odpowiada dokładnie pozycjom renderowanym w CustomChecklistsHeader.
 */
export function computeOrderChecklistProgress(
  steps: Array<{
    _id: string;
    orderId: string;
    parentId?: string;
    done: boolean;
    archived?: boolean;
  }>
): Record<string, OrderChecklistProgress> {
  const byOrder = new Map<string, typeof steps>();
  for (const s of steps) {
    if (s.archived) continue;
    let arr = byOrder.get(s.orderId);
    if (!arr) {
      arr = [];
      byOrder.set(s.orderId, arr);
    }
    arr.push(s);
  }

  const result: Record<string, OrderChecklistProgress> = {};

  for (const [orderId, active] of byOrder.entries()) {
    const childrenByParent = new Map<string, typeof steps>();
    const roots: typeof steps = [];

    for (const s of active) {
      if (!s.parentId) {
        roots.push(s);
      } else {
        let children = childrenByParent.get(s.parentId);
        if (!children) {
          children = [];
          childrenByParent.set(s.parentId, children);
        }
        children.push(s);
      }
    }

    let total = 0;
    let done = 0;
    const visited = new Set<string>();

    const walk = (parentId: string) => {
      const children = childrenByParent.get(parentId);
      if (!children) return;
      for (const child of children) {
        if (visited.has(child._id)) continue;
        visited.add(child._id);
        total += 1;
        if (child.done) done += 1;
        walk(child._id);
      }
    };

    for (const root of roots) {
      walk(root._id);
    }

    if (total > 0) {
      result[orderId] = { done, total };
    }
  }

  return result;
}
