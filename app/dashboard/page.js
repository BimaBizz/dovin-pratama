import { Activity, CircleUserRound, Clock3, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth";

export const metadata = {
  title: "Dashboard",
  description: "Dashboard superuser",
};

export default async function DashboardPage() {
  const session = await requireAuthenticatedUser();
  const displayName = session.user.fullName || "Pengguna";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge>Dashboard</Badge>
            <CardTitle className="mt-3 text-2xl">Selamat datang, {displayName}</CardTitle>
            <CardDescription className="mt-1">Login berhasil. Anda berada di panel utama operasional.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Role</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-zinc-500" />
              {session.user.role}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Status Session</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-600" />
              Active
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>User Scope</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-zinc-500" />
              Internal Admin
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Server Time</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-zinc-500" />
              {new Date().toLocaleString("id-ID")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ringkasan Akses</CardTitle>
            <CardDescription>Struktur panel ini menggunakan komponen style shadcn block.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-600">
            <p>
              Anda dapat menambahkan widget operasional lain di area ini, seperti statistik user, aktivitas terakhir,
              atau kontrol manajemen sistem.
            </p>
            <p>Arsitektur halaman disusun dengan komponen reusable agar mudah diperluas untuk fitur admin berikutnya.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profil Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <CircleUserRound className="h-4 w-4" />
              <span>{displayName}</span>
            </div>
            <div className="rounded-md bg-zinc-100 px-3 py-2 text-zinc-700">Akses dashboard aktif sesuai role akun saat ini.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
