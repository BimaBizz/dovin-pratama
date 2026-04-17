"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { saveTeamScheduleGridAction } from "@/app/dashboard/management/kelola-jadwal/actions";
import { SHIFT_OPTIONS } from "@/app/dashboard/management/kelola-tim/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getMonthDays(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return [];
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const workDate = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
    const dateObject = new Date(year, monthIndex, day);

    return {
      workDate,
      dayName: dateObject.toLocaleDateString("id-ID", { weekday: "short" }),
      day,
    };
  });
}

function buildPageHref(teamId, month) {
  const params = new URLSearchParams();

  if (teamId) {
    params.set("teamId", teamId);
  }

  if (month) {
    params.set("month", month);
  }

  const query = params.toString();
  return query ? `?${query}` : "?";
}

function getShiftBadgeClass(shiftCode) {
  if (shiftCode === "P/S") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (shiftCode === "M") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (shiftCode === "L") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-zinc-200 bg-zinc-100 text-zinc-600";
}

function getVisibleUserName(user) {
  return user.fullName || user.email;
}

function buildPatternPreview(monthDays, patternRows) {
  const pattern = patternRows.map((row) => row.shiftCode).filter(Boolean);

  if (monthDays.length === 0 || pattern.length === 0) {
    return [];
  }

  return monthDays.map((day, index) => ({
    workDate: day.workDate,
    dayName: day.dayName,
    shiftCode: pattern[index % pattern.length],
  }));
}

function buildGridFromPattern(participants, monthDays, patternRows) {
  const preview = buildPatternPreview(monthDays, patternRows);
  const grid = {};

  for (const participant of participants) {
    grid[participant.id] = {};
    for (const day of monthDays) {
      const previewItem = preview.find((item) => item.workDate === day.workDate);
      grid[participant.id][day.workDate] = previewItem?.shiftCode || "";
    }
  }

  return grid;
}

function buildGridFromAssignments(participants, monthDays, assignments) {
  const grid = {};

  for (const participant of participants) {
    grid[participant.id] = {};
    for (const day of monthDays) {
      grid[participant.id][day.workDate] = "";
    }
  }

  for (const item of assignments) {
    if (!grid[item.userId]) {
      grid[item.userId] = {};
    }
    grid[item.userId][item.workDate] = item.shiftCode;
  }

  return grid;
}

export default function ScheduleManagementClient({
  teams = [],
  selectedTeamId = "",
  selectedMonth,
  participants = [],
  assignments = [],
  recentAssignments = [],
  initError = "",
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(initError);
  const [teamId, setTeamId] = useState(selectedTeamId);
  const [month, setMonth] = useState(selectedMonth);
  const [patternRows, setPatternRows] = useState([{ id: crypto.randomUUID(), shiftCode: "P/S" }]);
  const [gridMap, setGridMap] = useState({});

  const monthDays = useMemo(() => getMonthDays(month), [month]);
  const selectedTeamName = useMemo(() => teams.find((team) => team.id === teamId)?.name || "", [teams, teamId]);
  const patternPreview = useMemo(() => buildPatternPreview(monthDays, patternRows), [monthDays, patternRows]);

  useEffect(() => {
    if (participants.length === 0 || monthDays.length === 0) {
      setGridMap({});
      return;
    }

    if (assignments.length > 0) {
      setGridMap(buildGridFromAssignments(participants, monthDays, assignments));
      return;
    }

    setGridMap(buildGridFromPattern(participants, monthDays, patternRows));
  }, [participants, assignments, monthDays]);

  function handleFilterSubmit(event) {
    event.preventDefault();
    router.push(buildPageHref(teamId, month));
  }

  function handlePatternChange(rowId, shiftCode) {
    setPatternRows((previous) => previous.map((row) => (row.id === rowId ? { ...row, shiftCode } : row)));
  }

  function addPatternRow() {
    setPatternRows((previous) => [...previous, { id: crypto.randomUUID(), shiftCode: "P/S" }]);
  }

  function removePatternRow(rowId) {
    setPatternRows((previous) => (previous.length <= 1 ? previous : previous.filter((row) => row.id !== rowId)));
  }

  function applyPatternToGrid() {
    if (participants.length === 0 || monthDays.length === 0) {
      setMessage("Pilih tim dan periode terlebih dahulu.");
      return;
    }

    setGridMap(buildGridFromPattern(participants, monthDays, patternRows));
    setMessage("Pola diterapkan ke grid jadwal.");
  }

  function updateGridCell(userId, workDate, shiftCode) {
    setGridMap((previous) => ({
      ...previous,
      [userId]: {
        ...(previous[userId] || {}),
        [workDate]: shiftCode,
      },
    }));
  }

  function submitGrid() {
    if (!teamId) {
      setMessage("Pilih tim terlebih dahulu.");
      return;
    }

    if (!month) {
      setMessage("Pilih periode bulan terlebih dahulu.");
      return;
    }

    if (participants.length === 0) {
      setMessage("Tim belum memiliki leader atau anggota.");
      return;
    }

    const entries = participants.flatMap((participant) =>
      monthDays.map((day) => ({
        userId: participant.id,
        workDate: day.workDate,
        shiftCode: gridMap[participant.id]?.[day.workDate] || "",
      }))
    );

    setMessage("");

    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("month", month);
    formData.set("entries", JSON.stringify(entries));

    startTransition(async () => {
      const result = await saveTeamScheduleGridAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage("Jadwal berhasil disimpan.");
      router.refresh();
    });
  }

  function exportSchedule(format) {
    if (!teamId) {
      setMessage("Pilih tim terlebih dahulu.");
      return;
    }

    if (!month) {
      setMessage("Pilih periode bulan terlebih dahulu.");
      return;
    }

    const params = new URLSearchParams({
      teamId,
      month,
      format,
    });

    window.open(`/api/dashboard/management/schedules/export?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Kelola Jadwal</CardTitle>
          <CardDescription>
            Atur jadwal kerja per tim dengan 3 shift: P/S, M, dan L. Grid di bawah menampilkan nama anggota tim per tanggal, lalu setiap sel bisa diedit manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_200px_auto]" onSubmit={handleFilterSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor="schedule-team-filter">
                Tim
              </label>
              <select
                id="schedule-team-filter"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
                required
              >
                <option value="">Pilih tim</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor="schedule-month-filter">
                Periode
              </label>
              <input
                id="schedule-month-filter"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
                required
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" variant="outline" className="w-full md:w-auto">
                Tampilkan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Batch Pola Jadwal</CardTitle>
            <CardDescription>
              Isi pola shift berurutan, misalnya P/S, P/S, M, M, L, L. Pola ini diputar ke seluruh tanggal dan kemudian bisa diedit manual per anggota.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" variant="outline" disabled={!teamId || !month} onClick={() => exportSchedule("excel")}>
              <Download />
              Export Excel
            </Button>
            <Button type="button" variant="outline" disabled={!teamId || !month} onClick={() => exportSchedule("pdf")}>
              <Download />
              Export PDF
            </Button>
            <Button type="button" disabled={pending || !teamId || monthDays.length === 0} onClick={submitGrid}>
              <Save />
              Simpan Jadwal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedTeamName ? (
            <p className="text-sm text-zinc-600">
              Tim aktif: <span className="font-semibold text-zinc-900">{selectedTeamName}</span> periode <span className="font-semibold text-zinc-900">{month}</span>.
            </p>
          ) : null}

          {!teamId ? <p className="text-sm text-zinc-500">Pilih tim terlebih dahulu untuk mulai mengatur jadwal.</p> : null}
          {teamId && monthDays.length === 0 ? <p className="text-sm text-zinc-500">Periode bulan tidak valid.</p> : null}

          {teamId && monthDays.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Pola Shift</p>
                    <p className="text-xs text-zinc-500">Tambahkan urutan shift untuk satu siklus. Setelah itu klik Terapkan Pola ke Grid.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={addPatternRow}>
                    <Plus />
                    Tambah Pola
                  </Button>
                </div>

                <div className="space-y-2">
                  {patternRows.map((row, index) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <div className="w-14 text-sm font-medium text-zinc-500">#{index + 1}</div>
                      <select
                        value={row.shiftCode}
                        onChange={(event) => handlePatternChange(row.id, event.target.value)}
                        className="h-10 min-w-40 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                      >
                        {SHIFT_OPTIONS.map((shift) => (
                          <option key={shift.value} value={shift.value}>
                            {shift.label}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" size="icon" onClick={() => removePatternRow(row.id)} disabled={patternRows.length <= 1}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={applyPatternToGrid} disabled={!teamId || !monthDays.length}>
                    Terapkan Pola ke Grid
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-zinc-200 p-4">
                <p className="text-sm font-semibold text-zinc-900">Preview Pola Harian</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-140 text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500">
                        <th className="px-2 py-3">Tanggal</th>
                        <th className="px-2 py-3">Hari</th>
                        <th className="px-2 py-3">Shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patternPreview.map((item) => (
                        <tr key={item.workDate} className="border-b border-zinc-100">
                          <td className="px-2 py-3 font-medium text-zinc-900">{item.workDate}</td>
                          <td className="px-2 py-3 text-zinc-700">{item.dayName}</td>
                          <td className="px-2 py-3">
                            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${getShiftBadgeClass(item.shiftCode)}`}>
                              {item.shiftCode || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-zinc-200 p-4">
                <p className="text-sm font-semibold text-zinc-900">Grid Manual per Anggota</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-275 text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500">
                        <th className="sticky left-0 z-10 bg-white px-2 py-3">Nama Anggota</th>
                        <th className="sticky left-65 z-10 bg-white px-2 py-3">Role</th>
                        {monthDays.map((day) => (
                          <th key={day.workDate} className="px-2 py-3 whitespace-nowrap">
                            {day.workDate}
                            <div className="text-[11px] text-zinc-400">{day.dayName}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant) => (
                        <tr key={participant.id} className="border-b border-zinc-100">
                          <td className="sticky left-0 z-10 bg-white px-2 py-3 font-medium text-zinc-900">
                            {getVisibleUserName(participant)}
                          </td>
                          <td className="sticky left-65 z-10 bg-white px-2 py-3 text-zinc-700">{participant.role}</td>
                          {monthDays.map((day) => {
                            const value = gridMap[participant.id]?.[day.workDate] || "";

                            return (
                              <td key={`${participant.id}-${day.workDate}`} className="px-2 py-3">
                                <select
                                  value={value}
                                  onChange={(event) => updateGridCell(participant.id, day.workDate, event.target.value)}
                                  className="h-9 min-w-30 rounded-md border border-zinc-200 bg-white px-2 text-sm"
                                >
                                  <option value="">-</option>
                                  {SHIFT_OPTIONS.map((shift) => (
                                    <option key={shift.value} value={shift.value}>
                                      {shift.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Jadwal Terbaru</CardTitle>
          <CardDescription>Menampilkan 30 perubahan jadwal terbaru untuk monitoring cepat.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-3">Tanggal</th>
                  <th className="px-2 py-3">Tim</th>
                  <th className="px-2 py-3">Anggota</th>
                  <th className="px-2 py-3">Shift</th>
                </tr>
              </thead>
              <tbody>
                {recentAssignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-zinc-100">
                    <td className="px-2 py-3 text-zinc-700">{assignment.workDate}</td>
                    <td className="px-2 py-3 font-medium text-zinc-900">{assignment.teamName}</td>
                    <td className="px-2 py-3 text-zinc-700">{assignment.userName}</td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${getShiftBadgeClass(assignment.shiftCode)}`}>
                        {assignment.shiftCode}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentAssignments.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-zinc-500" colSpan={4}>
                      Belum ada jadwal.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
