"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const contacts = useQuery(api.contacts.list);
  const addContact = useMutation(api.contacts.add);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    await addContact({ name, email });
    setName("");
    setEmail("");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Exalco CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Next.js 16 · React · TypeScript · Convex
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Dodaj kontakt</CardTitle>
          <CardDescription>Nowy lead zostanie zapisany w Convex.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Imię i nazwisko</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@example.com"
              />
            </div>
            <Button type="submit" className="w-fit">
              Dodaj
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-lg font-medium mb-3">Kontakty</h2>
        {contacts === undefined ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Brak kontaktów. Dodaj pierwszy ↑
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {contacts.map((c) => (
              <li key={c._id} className="px-4 py-3">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.email}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
