"use client";

import { DocumentListPage } from "../_components/document-view";

export default function RwListPage() {
  return (
    <DocumentListPage
      type="RW"
      title="RW — Wydania wewnętrzne"
      subtitle="Wydanie obiektów magazynowych z magazynu głównego do bufora produkcyjnego lub na zlecenie."
      createLabel="Nowe wydanie RW"
    />
  );
}
