"use client";

import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { GanttPanelContent } from "../_components/gantt-panel-content";

export default function HarmonogramPage() {
  const router = useRouter();

  function handleOpenOrder(orderId: Id<"orders">) {
    router.push(`/admin/zlecenia/${orderId}?from=gantt`);
  }

  return (
    <main style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GanttPanelContent onOpenOrder={handleOpenOrder} />
    </main>
  );
}
