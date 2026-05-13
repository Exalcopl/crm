import { Suspense } from "react";
import { SignInForm } from "./SignInForm";
import "./signin.css";

export const metadata = {
  title: "Logowanie · Exalco CRM",
};

export default function SignInPage() {
  return (
    <main className="signin-shell">
      <div className="signin-card">
        <div className="signin-brand">
          <span className="signin-brand-mark">E</span>
          <div>
            <div className="signin-brand-title">Exalco CRM</div>
            <div className="signin-brand-sub">Panel administracyjny</div>
          </div>
        </div>
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
