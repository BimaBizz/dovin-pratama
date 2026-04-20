"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createStandbyLocationAction,
  deleteStandbyLocationAction,
  saveAttendanceSettingAction,
  updateStandbyLocationAction,
} from "@/app/dashboard/absensi/pengaturan/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SHIFT_ROWS = ["P/S", "M", "L"];

function cloneSetting(setting) {
  if (setting === undefined || setting === null) {
    return setting;
  }

  return JSON.parse(JSON.stringify(setting));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AttendanceSettingClient({
  initialSetting,
  locations = [],
  locationInitError = "",
  canManage,
  viewerRolePriority,
  maxPriority,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [setting, setSetting] = useState(() => cloneSetting(initialSetting));
  const [activeTab, setActiveTab] = useState("window-shift");
  const [locationFormMode, setLocationFormMode] = useState("create");
  const [editingLocationId, setEditingLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationPriority, setLocationPriority] = useState("0");

  const shiftEntries = useMemo(() => SHIFT_ROWS.map((shiftCode) => ({ shiftCode, ...setting.shifts[shiftCode] })), [setting]);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => a.priority - b.priority || a.locationName.localeCompare(b.locationName));
  }, [locations]);

  function updateShift(shiftCode, field, value) {
    setSetting((previous) => ({
      ...previous,
      shifts: {
        ...previous.shifts,
        [shiftCode]: {
          ...previous.shifts[shiftCode],
          [field]: value,
        },
      },
    }));
  }

  function handleSubmitWindowShift(event) {
    event.preventDefault();

    if (!canManage) {
      setMessage("Role Anda tidak memiliki hak mengubah setting absensi.");
      return;
    }

    const normalized = {
      shifts: {},
    };

    for (const shiftCode of SHIFT_ROWS) {
      const row = setting.shifts[shiftCode];
      const beforeMinutes = toNumber(row.beforeMinutes);
      const afterMinutes = toNumber(row.afterMinutes);

      if (beforeMinutes === null || afterMinutes === null) {
        setMessage(`Window ${shiftCode} harus berupa angka >= 0.`);
        return;
      }

      normalized.shifts[shiftCode] = {
        label: String(row.label || shiftCode).trim() || shiftCode,
        startTime: String(row.startTime || "").trim(),
        endTime: String(row.endTime || "").trim(),
        beforeMinutes,
        afterMinutes,
      };
    }

    const formData = new FormData();
    formData.set("configJson", JSON.stringify(normalized));

    setMessage("");

    startTransition(async () => {
      const result = await saveAttendanceSettingAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage("Setting absensi berhasil disimpan.");
      router.refresh();
    });
  }

  function resetLocationForm() {
    setLocationFormMode("create");
    setEditingLocationId("");
    setLocationName("");
    setLocationPriority("0");
  }

  function startEditLocation(item) {
    setLocationFormMode("edit");
    setEditingLocationId(item.id);
    setLocationName(item.locationName || "");
    setLocationPriority(String(item.priority ?? 0));
    setMessage("");
  }

  function handleSubmitLocation(event) {
    event.preventDefault();

    if (!canManage) {
      setMessage("Role Anda tidak memiliki hak mengubah data lokasi.");
      return;
    }

    const normalizedLocationName = String(locationName || "").trim();
    if (!normalizedLocationName) {
      setMessage("Nama lokasi wajib diisi.");
      return;
    }

    const normalizedPriority = Number(locationPriority);
    if (!Number.isInteger(normalizedPriority) || normalizedPriority < 0) {
      setMessage("Priority lokasi harus angka bulat >= 0.");
      return;
    }

    const formData = new FormData();
    formData.set("locationName", normalizedLocationName);
    formData.set("priority", String(normalizedPriority));

    if (locationFormMode === "edit") {
      formData.set("id", editingLocationId);
    }

    const action = locationFormMode === "edit" ? updateStandbyLocationAction : createStandbyLocationAction;

    setMessage("");

    startTransition(async () => {
      const result = await action(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(locationFormMode === "edit" ? "Lokasi berhasil diperbarui." : "Lokasi berhasil ditambahkan.");
      resetLocationForm();
      router.refresh();
    });
  }

  function handleDeleteLocation(id) {
    if (!canManage) {
      setMessage("Role Anda tidak memiliki hak menghapus data lokasi.");
      return;
    }

    const confirmed = typeof window !== "undefined" ? window.confirm("Hapus lokasi ini?") : false;
    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("id", id);

    setMessage("");

    startTransition(async () => {
      const result = await deleteStandbyLocationAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      if (editingLocationId === id) {
        resetLocationForm();
      }

      setMessage("Lokasi berhasil dihapus.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Absensi</CardTitle>
          <CardDescription>
            Atur jam buka/tutup absensi untuk shift P/S, M, dan L. User hanya bisa absen di dalam window yang diizinkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Priority Anda: {viewerRolePriority}</Badge>
            <Badge variant="outline">Priority Tertinggi: {maxPriority}</Badge>
            <Badge variant={canManage ? "default" : "secondary"}>{canManage ? "Boleh Edit" : "Read Only"}</Badge>
          </div>
          {!canManage ? <p className="text-zinc-600">Hanya role dengan prioritas tertinggi yang dapat mengubah setting ini.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Tab</CardTitle>
          <CardDescription>Pilih tab untuk mengatur window shift atau daftar nama lokasi.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={activeTab === "window-shift" ? "default" : "outline"} onClick={() => setActiveTab("window-shift")}>
              Window Shift
            </Button>
            <Button type="button" variant={activeTab === "location" ? "default" : "outline"} onClick={() => setActiveTab("location")}>
              Location
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeTab === "window-shift" ? (
        <form className="space-y-4" onSubmit={handleSubmitWindowShift}>
          <Card>
            <CardHeader>
              <CardTitle>Window Shift</CardTitle>
              <CardDescription>Format jam menggunakan HH:MM. before/after dihitung dari Start Time (jam buka absensi). Contoh: Start 08:00, before 60, after 30 berarti window 07:00 - 08:30.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shiftEntries.map((shift) => (
                  <div key={shift.shiftCode} className="grid gap-3 rounded-md border border-zinc-200 p-4 md:grid-cols-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Shift</label>
                      <Input value={shift.shiftCode} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Label</label>
                      <Input value={shift.label} disabled={!canManage} onChange={(event) => updateShift(shift.shiftCode, "label", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Start Time</label>
                      <Input type="time" value={shift.startTime} disabled={!canManage} onChange={(event) => updateShift(shift.shiftCode, "startTime", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">End Time</label>
                      <Input type="time" value={shift.endTime} disabled={!canManage} onChange={(event) => updateShift(shift.shiftCode, "endTime", event.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700">Before (menit)</label>
                        <Input type="number" min={0} value={String(shift.beforeMinutes)} disabled={!canManage} onChange={(event) => updateShift(shift.shiftCode, "beforeMinutes", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700">After (menit)</label>
                        <Input type="number" min={0} value={String(shift.afterMinutes)} disabled={!canManage} onChange={(event) => updateShift(shift.shiftCode, "afterMinutes", event.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

          <Button type="submit" disabled={pending || !canManage}>
            Simpan Setting Absensi
          </Button>
        </form>
      ) : null}

      {activeTab === "location" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>CRUD master nama lokasi untuk dipakai di rekap absensi.</CardDescription>
            </CardHeader>
            <CardContent>
              {locationInitError ? <p className="text-sm text-red-600">{locationInitError}</p> : null}

              <form className="grid gap-3 rounded-md border border-zinc-200 p-4 md:grid-cols-[1fr_180px_auto]" onSubmit={handleSubmitLocation}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Nama Lokasi</label>
                  <Input
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    placeholder="Contoh: Posko Barat"
                    disabled={!canManage || pending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Priority</label>
                  <Input
                    type="number"
                    min={0}
                    value={locationPriority}
                    onChange={(event) => setLocationPriority(event.target.value)}
                    disabled={!canManage || pending}
                    required
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" disabled={!canManage || pending || Boolean(locationInitError)}>
                    {locationFormMode === "edit" ? "Update" : "Tambah"}
                  </Button>
                  {locationFormMode === "edit" ? (
                    <Button type="button" variant="outline" onClick={resetLocationForm} disabled={pending}>
                      Batal
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="px-2 py-3">Nama Lokasi</th>
                      <th className="px-2 py-3">Priority</th>
                      <th className="px-2 py-3">Update Terakhir</th>
                      <th className="px-2 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLocations.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-100">
                        <td className="px-2 py-3 text-zinc-900">{item.locationName}</td>
                        <td className="px-2 py-3 text-zinc-700">{item.priority}</td>
                        <td className="px-2 py-3 text-zinc-700">{formatDateTime(item.updatedAt)}</td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => startEditLocation(item)} disabled={!canManage || pending}>
                              Edit
                            </Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteLocation(item.id)} disabled={!canManage || pending}>
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sortedLocations.length === 0 ? (
                      <tr>
                        <td className="px-2 py-4 text-zinc-500" colSpan={4}>
                          Belum ada data lokasi.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
