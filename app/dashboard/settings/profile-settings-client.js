"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateOwnProfileAction } from "@/app/dashboard/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfileSettingsClient({ profile, initError = "" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(initError);
  const [success, setSuccess] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="outline">Settings</Badge>
          <CardTitle className="mt-1">Edit Data Pribadi</CardTitle>
          <CardDescription>
            Ubah informasi profil akun Anda. Password hanya diubah jika field password baru diisi.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage("");
              setSuccess("");

              startTransition(async () => {
                const result = await updateOwnProfileAction(new FormData(event.currentTarget));
                if (result?.error) {
                  setMessage(result.error);
                  return;
                }

                setSuccess("Profil berhasil diperbarui.");
                router.refresh();
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-full-name">Nama Lengkap</Label>
                <Input id="settings-full-name" name="fullName" defaultValue={profile?.fullName || ""} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" name="email" type="email" defaultValue={profile?.email || ""} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-birth-place">Tempat Lahir</Label>
                <Input id="settings-birth-place" name="birthPlace" defaultValue={profile?.birthPlace || ""} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-birth-date">Tanggal Lahir</Label>
                <Input id="settings-birth-date" name="birthDate" type="date" defaultValue={profile?.birthDate || ""} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-address">Alamat</Label>
              <textarea
                id="settings-address"
                name="address"
                defaultValue={profile?.address || ""}
                required
                className="min-h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-password">Password Baru (opsional)</Label>
              <Input id="settings-password" name="password" type="password" placeholder="Kosongkan jika tidak ingin ganti password" />
            </div>

            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

            <Button className="w-full sm:w-auto" type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}