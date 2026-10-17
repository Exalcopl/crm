"use client";

import { DocumentListPage } from "../_components/document-view";

export default function PzListPage() {
  return (
    <DocumentListPage
      type="PZ"
      title="PZ — Przyjęcia zewnętrzne"
      subtitle="Przyjęcie zdefiniowanych obiektów magazynowych na stan."
      createLabel="Nowe przyjęcie PZ"
    />
  );
}
