"use client";

import { useState, useTransition } from "react";

import { updateAttendanceGuardLocationAction } from "@/app/dashboard/absensi/rekap/actions";

export default function GuardLocationSelect({ attendanceRecordId, initialLocationLabel = "", locationOptions = [] }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialLocationLabel);
  const [message, setMessage] = useState("");

  function handleChange(event) {
    const nextValue = event.target.value;
    setValue(nextValue);
    setMessage("");

    const formData = new FormData();
    formData.set("attendanceRecordId", attendanceRecordId);
    formData.set("locationLabel", nextValue);

    startTransition(async () => {
      const result = await updateAttendanceGuardLocationAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage("Tersimpan");
    });
  }

  return (
    <div className="space-y-1">
      <select
        className="flex h-9 min-w-44 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        onChange={handleChange}
        disabled={pending || locationOptions.length === 0}
      >
        <option value="">Pilih lokasi jaga</option>
        {locationOptions.map((locationName) => (
          <option key={locationName} value={locationName}>
            {locationName}
          </option>
        ))}
      </select>
      {message ? <p className="text-[11px] text-zinc-500">{message}</p> : null}
    </div>
  );
}
