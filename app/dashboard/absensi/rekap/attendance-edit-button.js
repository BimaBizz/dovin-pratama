"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateAttendanceRecapRecordAction } from "@/app/dashboard/absensi/rekap/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatTimeInputValue(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "";
  }

  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export default function AttendanceEditButton({ attendanceRecord, canEdit = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(attendanceRecord?.status || "PRESENT");
  const [attendedTime, setAttendedTime] = useState(formatTimeInputValue(attendanceRecord?.attendedAt));

  if (!attendanceRecord) {
    return null;
  }

  function closeModal() {
    if (pending) {
      return;
    }

    setOpen(false);
    setMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canEdit) {
      setMessage("Anda tidak memiliki akses edit rekap absensi.");
      return;
    }

    const formData = new FormData();
    formData.set("attendanceRecordId", attendanceRecord.id);
    formData.set("status", status);
    formData.set("attendedTime", attendedTime);

    setMessage("");

    startTransition(async () => {
      const result = await updateAttendanceRecapRecordAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setOpen(false);
      setMessage("");
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!canEdit}>
        Edit
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white shadow-xl">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-base font-semibold text-zinc-900">Edit Data Absensi</h3>
              <p className="mt-1 text-sm text-zinc-500">Perbarui status dan jam absen.</p>
            </div>

            <form className="space-y-4 p-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  disabled={pending}
                >
                  <option value="PRESENT">Hadir</option>
                  <option value="SICK">Sakit</option>
                  <option value="LEAVE">Cuti</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700" htmlFor={`attended-time-${attendanceRecord.id}`}>Jam Absen</label>
                <Input
                  id={`attended-time-${attendanceRecord.id}`}
                  type="time"
                  step="60"
                  value={attendedTime}
                  onChange={(event) => setAttendedTime(event.target.value)}
                  disabled={pending}
                  required
                />
              </div>

              {message ? <p className="text-sm text-red-600">{message}</p> : null}

              <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={pending}>
                  Batal
                </Button>
                <Button type="submit" disabled={pending}>
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
