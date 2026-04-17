"use server";

import { redirect } from "next/navigation";

import { loginWithEmailPassword } from "@/lib/auth";

export async function loginAction(_, formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { message: "Email dan password wajib diisi." };
  }

  const result = await loginWithEmailPassword(email, password);

  if (!result.success) {
    return { message: result.message };
  }

  redirect("/dashboard");
}
