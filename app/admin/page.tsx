import { redirect } from "next/navigation";

export default async function AdminIndex() {
  redirect("/admin/panel");
}

