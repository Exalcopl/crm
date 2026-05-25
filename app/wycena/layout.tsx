import type { Metadata } from "next";
import Link from "next/link";
import "./wycena.css";

export const metadata: Metadata = {
  title: "Wyceń projekt — Exalco",
  description:
    "Wyślij zapytanie o wycenę zadaszenia, pergoli, stolarki, ogrodzenia lub osłon okiennych. Odezwiemy się tego samego dnia.",
};

export default function WycenaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="wp-root">
      <header className="wp-header">
        <div className="wp-header-inner">
          <Link href="/" className="wp-brand">
            <span className="wp-brand-mark">E</span>
            <span>Exalco</span>
          </Link>
          <div className="wp-header-contact">
            <a href="tel:+48000000000">+48 000 000 000</a>
            <a href="mailto:biuro@alcopl.pl">biuro@alcopl.pl</a>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
