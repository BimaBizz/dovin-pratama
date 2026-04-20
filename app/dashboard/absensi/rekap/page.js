import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAttendanceStatusLabel } from "@/lib/attendance-status";
import { getAttendanceSetting } from "@/lib/attendance-settings";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getRolePriority, getRolePriorityMap } from "@/lib/role-priority";
import Link from "next/link";

import AttendanceEditButton from "@/app/dashboard/absensi/rekap/attendance-edit-button";
import GuardLocationSelect from "@/app/dashboard/absensi/rekap/guard-location-select";

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

function getShiftLabel(shiftCode, shiftLabelMap) {
  return shiftLabelMap[shiftCode] || shiftCode;
}

function getShiftTimeRangeLabel(shiftCode, attendanceSetting) {
  const startTime = attendanceSetting?.shifts?.[shiftCode]?.startTime || "";
  const endTime = attendanceSetting?.shifts?.[shiftCode]?.endTime || "";

  if (!startTime || !endTime) {
    return "-";
  }

  return `${startTime} - ${endTime}`;
}

function formatRoleLabel(role) {
  const normalized = String(role || "").trim();
  if (!normalized) {
    return "-";
  }

  const lower = normalized.toLowerCase().replace(/_/g, " ");
  return lower.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPeopleList(people) {
  if (!people || people.length === 0) {
    return "Tidak Ada";
  }

  return people
    .map((row, index) => `${index + 1}. ${buildUserDisplayName(row.user)} (${formatRoleLabel(row.user?.role)})`)
    .join("\n");
}

function formatKetPeopleList(people) {
  if (!people || people.length === 0) {
    return "Tidak Ada";
  }

  return people
    .map((row, index) => `${index + 1}. ${buildUserDisplayName(row.user)} (${formatRoleLabel(row.user?.role)})`)
    .join("\n");
}

function normalizeLocationKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildWhatsappReportText({ dateLabel, shiftLabel, shiftTimeRange, rows, locationPriorityMap }) {
  const presentRows = rows.filter((row) => row.attendanceRecord?.status === "PRESENT");
  const groupedByGuardLocation = presentRows.reduce((accumulator, row) => {
    const key = String(row.attendanceRecord?.locationLabel || "").trim();

    if (!key) {
      return accumulator;
    }

    if (!accumulator[key]) {
      accumulator[key] = [];
    }

    accumulator[key].push(row);
    return accumulator;
  }, {});

  const locationSections = Object.keys(groupedByGuardLocation)
    .sort((b, a) => {
      const aPriority = Number(locationPriorityMap[normalizeLocationKey(a)] ?? Number.MAX_SAFE_INTEGER);
      const bPriority = Number(locationPriorityMap[normalizeLocationKey(b)] ?? Number.MAX_SAFE_INTEGER);
      return aPriority - bPriority || a.localeCompare(b);
    })
    .map((locationName) => `${locationName}:\n${formatPeopleList(groupedByGuardLocation[locationName])}`)
    .join("\n\n");

  const sickRows = rows.filter((row) => row.attendanceRecord?.status === "SICK");
  const leaveRows = rows.filter((row) => row.attendanceRecord?.status === "LEAVE");

  const lines = [
    `Laporan kehadiran personil pekerjaan Kontrak Payung Pemeliharaan dan Perawatan Peralatan Passenger Movement System ( PT. Dovin Pratama ). ${dateLabel}`,
    "",
    `${shiftLabel} ( ${shiftTimeRange} )`,
    "",
    locationSections || "Belum ada personil yang sudah absen.",
    "",
    "Ket:",
    "-. Izin : Tidak Ada",
    "-. Sakit :",
    formatKetPeopleList(sickRows),
    "-. Cuti :",
    formatKetPeopleList(leaveRows),
    "",
    "Terima kasih.",
  ];

  return lines.join("\n");
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
  const { evaluator } = await requirePagePermission("attendance-recap", "view");

  const resolvedSearchParams = await searchParams;
  const [attendanceSetting, rolePriorityMap] = await Promise.all([
    getAttendanceSetting(),
    getRolePriorityMap(),
  ]);
  const selectedDate = String(resolvedSearchParams?.date || getDefaultDate()).trim();
  const selectedTeamId = String(resolvedSearchParams?.teamId || "").trim();
  const selectedShift = String(resolvedSearchParams?.shift || "").trim();
  const shiftLabelMap = {
    "P/S": attendanceSetting?.shifts?.["P/S"]?.label || "P/S",
    M: attendanceSetting?.shifts?.M?.label || "M",
    L: attendanceSetting?.shifts?.L?.label || "L",
  };

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const locationOptions = prisma.attendanceLocation?.findMany
    ? (
      await prisma.attendanceLocation.findMany({
        orderBy: [{ priority: "asc" }, { locationName: "asc" }],
        select: { locationName: true, priority: true },
      })
    )
    : [];

  const locationPriorityMap = locationOptions.reduce((accumulator, item) => {
    accumulator[normalizeLocationKey(item.locationName)] = item.priority;
    return accumulator;
  }, {});
  const locationNames = locationOptions.map((item) => item.locationName);

  const canEditRecap = evaluator.canCrud("attendance-recap", "update");

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
              photoPath: true,
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
                    {getShiftLabel(shiftCode, shiftLabelMap)}
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
                <p className="text-xs uppercase tracking-wide text-zinc-500">Shift {getShiftLabel(shiftCode, shiftLabelMap)}</p>
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
          const sortedRows = [...rows].sort((a, b) => {
            const aPriority = getRolePriority(rolePriorityMap, a.user?.role);
            const bPriority = getRolePriority(rolePriorityMap, b.user?.role);

            if (aPriority !== bPriority) {
              return bPriority - aPriority;
            }

            return buildUserDisplayName(a.user).localeCompare(buildUserDisplayName(b.user));
          });

          const belumRows = sortedRows.filter((row) => !row.attendanceRecord);
          const sickRows = sortedRows.filter((row) => row.attendanceRecord?.status === "SICK");
          const leaveRows = sortedRows.filter((row) => row.attendanceRecord?.status === "LEAVE");
          const presentRows = sortedRows.filter((row) => row.attendanceRecord?.status === "PRESENT");
          const attendanceRows = sortedRows.filter((row) => row.attendanceRecord);
          const shiftLabel = `Dinas ${getShiftLabel(shiftCode, shiftLabelMap)}`;
          const shiftTimeRange = getShiftTimeRangeLabel(shiftCode, attendanceSetting);
          const whatsappText = buildWhatsappReportText({
            dateLabel: formatDateLabel(workDateKey),
            shiftLabel,
            shiftTimeRange,
            rows: sortedRows,
            locationPriorityMap,
          });
          const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

          return (
            <Card key={shiftCode}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Shift {getShiftLabel(shiftCode, shiftLabelMap)} - {shiftTimeRange}</CardTitle>
                  <Button asChild type="button" variant="outline" className="h-9 w-full sm:w-auto">
                    <Link href={whatsappHref} target="_blank" rel="noreferrer">
                      Share WhatsApp
                    </Link>
                  </Button>
                </div>
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
                        <th className="px-2 py-3">Lokasi Jaga</th>
                        <th className="px-2 py-3">Waktu Absen</th>
                        <th className="px-2 py-3">Lokasi Absen</th>
                        <th className="px-2 py-3">Foto</th>
                        <th className="px-2 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row) => (
                        <tr key={row.id} className="border-b border-zinc-100">
                          <td className="px-2 py-3 font-medium text-zinc-900">{buildUserDisplayName(row.user)}</td>
                          <td className="px-2 py-3 text-zinc-700">{row.user?.role || "-"}</td>
                          <td className="px-2 py-3">{getStatusBadge(row.attendanceRecord)}</td>
                          <td className="px-2 py-3 text-zinc-700">
                            {row.attendanceRecord ? (
                              <GuardLocationSelect
                                attendanceRecordId={row.attendanceRecord.id}
                                initialLocationLabel={row.attendanceRecord.locationLabel || ""}
                                locationOptions={locationNames}
                              />
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-zinc-700">{row.attendanceRecord?.attendedAt ? new Date(row.attendanceRecord.attendedAt).toLocaleString("id-ID") : "-"}</td>
                          <td className="px-2 py-3 text-zinc-700">
                            {row.attendanceRecord?.latitude && row.attendanceRecord?.longitude ? (
                              <Link href={`https://www.google.com/maps?q=${row.attendanceRecord.latitude},${row.attendanceRecord.longitude}`} target="_blank" rel="noopener noreferrer" className="bg-(--primary) text-(--primary-foreground) shadow-sm hover:opacity-90 h-10 px-4 py-2 rounded-md">
                                LIHAT MAPS
                              </Link>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-zinc-700">
                            {row.attendanceRecord?.photoPath ? (
                              <Link href={`/api/dashboard/attendance/${row.attendanceRecord.id}/photo`} target="_blank" rel="noopener noreferrer" className="bg-(--primary) text-(--primary-foreground) shadow-sm hover:opacity-90 h-10 px-4 py-2 rounded-md">
                                LIHAT FOTO
                              </Link>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end">
                              <AttendanceEditButton
                                attendanceRecord={row.attendanceRecord}
                                canEdit={canEditRecap}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* <div className="grid gap-3 md:grid-cols-2">
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
                </div> */}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
