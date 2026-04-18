import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAttendanceStatusLabel } from "@/lib/attendance-status";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Rekap Absensi",
  description: "Rekap absensi per shift berdasarkan jadwal tim",
};

function getDefaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnly(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function formatDateLabel(dateText) {
  if (!dateText) {
    return "-";
  }

  return new Date(`${dateText}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function buildUserDisplayName(user) {
  return user?.fullName || user?.email || "-";
}

function getStatusBadge(attendanceRecord) {
  if (attendanceRecord) {
    if (attendanceRecord.status === "SICK") {
      return <Badge variant="secondary">Sakit</Badge>;
    }

    if (attendanceRecord.status === "LEAVE") {
      return <Badge variant="outline">Cuti</Badge>;
    }

    return <Badge>Hadir</Badge>;
  }

  return <Badge variant="secondary">Belum Absen</Badge>;
}

export default async function AttendanceRecapPage({ searchParams }) {
  await requirePagePermission("attendance-recap", "view");

  const resolvedSearchParams = await searchParams;
  const selectedDate = String(resolvedSearchParams?.date || getDefaultDate()).trim();
  const selectedTeamId = String(resolvedSearchParams?.teamId || "").trim();
  const selectedShift = String(resolvedSearchParams?.shift || "").trim();

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const activeTeamId = selectedTeamId || teams[0]?.id || "";
  const exportQuery = new URLSearchParams({
    date: selectedDate,
    teamId: activeTeamId,
    format: "excel",
  });

  if (selectedShift) {
    exportQuery.set("shift", selectedShift);
  }

  const pdfExportQuery = new URLSearchParams(exportQuery);
  pdfExportQuery.set("format", "pdf");

  const workDate = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? new Date(`${selectedDate}T00:00:00.000Z`) : new Date(`${getDefaultDate()}T00:00:00.000Z`);
  const workDateKey = toDateOnly(workDate) || getDefaultDate();

  const activeTeam = activeTeamId
    ? await prisma.team.findUnique({
        where: { id: activeTeamId },
        select: {
          id: true,
          name: true,
          leader: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      })
    : null;

  const assignments = activeTeamId
    ? await prisma.teamScheduleAssignment.findMany({
        where: {
          teamId: activeTeamId,
          workDate,
        },
        orderBy: [
          { shiftCode: "asc" },
          { userId: "asc" },
        ],
        select: {
          id: true,
          userId: true,
          shiftCode: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          attendanceRecord: {
            select: {
              id: true,
              attendedAt: true,
                  status: true,
                  note: true,
              latitude: true,
              longitude: true,
              accuracy: true,
              locationLabel: true,
            },
          },
        },
      })
    : [];

  const visibleAssignments = selectedShift ? assignments.filter((item) => item.shiftCode === selectedShift) : assignments;

  const groupedByShift = visibleAssignments.reduce((accumulator, item) => {
    if (!accumulator[item.shiftCode]) {
      accumulator[item.shiftCode] = [];
    }

    accumulator[item.shiftCode].push(item);
    return accumulator;
  }, {});

  const shiftOrder = ["P/S", "M", "L"].filter((shiftCode) => groupedByShift[shiftCode]?.length > 0 || (!selectedShift && assignments.some((item) => item.shiftCode === shiftCode)));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rekap Absensi</CardTitle>
          <CardDescription>
            Rekap hadir dan belum hadir per shift berdasarkan jadwal tim pada tanggal yang dipilih.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto_auto]" method="get">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor="recap-date">Tanggal</label>
              <Input id="recap-date" type="date" name="date" defaultValue={workDateKey} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor="recap-team">Tim</label>
              <select id="recap-team" name="teamId" defaultValue={activeTeamId} className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="">Pilih tim</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor="recap-shift">Shift</label>
              <select id="recap-shift" name="shift" defaultValue={selectedShift} className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="">Semua Shift</option>
                {["P/S", "M", "L"].map((shiftCode) => (
                  <option key={shiftCode} value={shiftCode}>
                    {shiftCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="h-10 px-4">
                Tampilkan
              </Button>
            </div>
            <div className="flex items-end">
              <Button asChild type="button" variant="outline" className="h-10 px-4">
                <Link href={`/api/dashboard/absensi/rekap/export?${exportQuery.toString()}`} target="_blank" rel="noreferrer">
                  Export Excel
                </Link>
              </Button>
            </div>
            <div className="flex items-end">
              <Button asChild type="button" variant="outline" className="h-10 px-4">
                <Link href={`/api/dashboard/absensi/rekap/export?${pdfExportQuery.toString()}`} target="_blank" rel="noreferrer">
                  Export PDF
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
          <CardDescription>
            {activeTeam ? `Tim ${activeTeam.name}` : "Belum ada tim yang dipilih"} · {formatDateLabel(workDateKey)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {["P/S", "M", "L"].map((shiftCode) => {
            const total = assignments.filter((item) => item.shiftCode === shiftCode).length;
            const hadir = assignments.filter((item) => item.shiftCode === shiftCode && item.attendanceRecord).length;
            const belum = total - hadir;

            return (
              <div key={shiftCode} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Shift {shiftCode}</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">{hadir} Hadir</p>
                <p className="text-sm text-zinc-600">{belum} Belum Absen · {total} Terjadwal</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {shiftOrder.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">
            Tidak ada jadwal untuk tanggal dan tim yang dipilih.
          </CardContent>
        </Card>
      ) : (
        shiftOrder.map((shiftCode) => {
          const rows = groupedByShift[shiftCode] || [];
          const belumRows = rows.filter((row) => !row.attendanceRecord);
          const sickRows = rows.filter((row) => row.attendanceRecord?.status === "SICK");
          const leaveRows = rows.filter((row) => row.attendanceRecord?.status === "LEAVE");
          const presentRows = rows.filter((row) => row.attendanceRecord?.status === "PRESENT");
          const attendanceRows = rows.filter((row) => row.attendanceRecord);

          return (
            <Card key={shiftCode}>
              <CardHeader>
                <CardTitle>Shift {shiftCode}</CardTitle>
                <CardDescription>
                  Hadir {presentRows.length} · Sakit {sickRows.length} · Cuti {leaveRows.length} · Belum Absen {belumRows.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500">
                        <th className="px-2 py-3">Nama</th>
                        <th className="px-2 py-3">Role</th>
                        <th className="px-2 py-3">Status</th>
                        <th className="px-2 py-3">Waktu Absen</th>
                        <th className="px-2 py-3">Lokasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-zinc-100">
                          <td className="px-2 py-3 font-medium text-zinc-900">{buildUserDisplayName(row.user)}</td>
                          <td className="px-2 py-3 text-zinc-700">{row.user?.role || "-"}</td>
                          <td className="px-2 py-3">{getStatusBadge(row.attendanceRecord)}</td>
                          <td className="px-2 py-3 text-zinc-700">{row.attendanceRecord?.attendedAt ? new Date(row.attendanceRecord.attendedAt).toLocaleString("id-ID") : "-"}</td>
                          <td className="px-2 py-3 text-zinc-700">
                            {row.attendanceRecord?.latitude && row.attendanceRecord?.longitude ? (
                              <Link href={`https://www.google.com/maps?q=${row.attendanceRecord.latitude},${row.attendanceRecord.longitude}`} target="_blank" rel="noopener noreferrer" className="underline">
                                {row.attendanceRecord?.locationLabel || "-"}
                              </Link>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">Sudah Absen</p>
                    {attendanceRows.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-800">Tidak ada data hadir.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-emerald-800">
                        {attendanceRows.map((row) => (
                          <li key={`${row.id}-hadir`}>
                            {buildUserDisplayName(row.user)} · {getAttendanceStatusLabel(row.attendanceRecord.status)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Belum Absen</p>
                    {belumRows.length === 0 ? (
                      <p className="mt-2 text-sm text-amber-800">Semua user di shift ini sudah absen.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-amber-800">
                        {belumRows.map((row) => (
                          <li key={`${row.id}-belum`}>{buildUserDisplayName(row.user)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm font-semibold text-sky-900">Izin Sakit</p>
                    {sickRows.length === 0 ? (
                      <p className="mt-2 text-sm text-sky-800">Tidak ada data sakit.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-sky-800">
                        {sickRows.map((row) => (
                          <li key={`${row.id}-sick`}>{buildUserDisplayName(row.user)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-md border border-violet-200 bg-violet-50 p-4">
                    <p className="text-sm font-semibold text-violet-900">Izin Cuti</p>
                    {leaveRows.length === 0 ? (
                      <p className="mt-2 text-sm text-violet-800">Tidak ada data cuti.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-violet-800">
                        {leaveRows.map((row) => (
                          <li key={`${row.id}-leave`}>{buildUserDisplayName(row.user)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
