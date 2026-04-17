import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import LoginForm from "@/app/login/login-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth";

export const metadata = {
  title: "Login",
  description: "Halaman login dashboard",
};

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-zinc-100 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-zinc-900 p-10 text-zinc-100 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="relative z-10">
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-900">
            Dashboard Access
          </Badge>
          <h1 className="mt-6 max-w-md text-4xl font-bold tracking-tight">Secure Admin Portal</h1>
          <p className="mt-4 max-w-md text-sm text-zinc-300">
            Masuk menggunakan akun yang terdaftar untuk mengakses dashboard operasional.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 text-sm text-zinc-300">
          <ShieldCheck className="h-4 w-4" />
          Proteksi sesi berbasis server dan database.
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900 text-zinc-100">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <CardTitle>Login Dashboard</CardTitle>
            <CardDescription>Gunakan kredensial akun yang sudah dibuat di sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
