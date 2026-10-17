"use client";

import { use } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { DocumentDetailView } from "../../_components/document-view";

export default function RwDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <DocumentDetailView
      id={id as Id<"wms_documents">}
      type="RW"
      backHref="/admin/wms/rw"
    />
  );
}
