"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveAttendanceSettingAction } from "@/app/dashboard/absensi/pengaturan/actions";
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

export default function AttendanceSettingClient({ initialSetting, canManage, viewerRolePriority, maxPriority }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [setting, setSetting] = useState(() => cloneSetting(initialSetting));

  const shiftEntries = useMemo(() => SHIFT_ROWS.map((shiftCode) => ({ shiftCode, ...setting.shifts[shiftCode] })), [setting]);

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

  function handleSubmit(event) {
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

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Window Shift</CardTitle>
            <CardDescription>Format jam menggunakan HH:MM. before/after dalam menit.</CardDescription>
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
    </div>
  );
}
