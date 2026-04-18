import AttendanceClient from "@/app/dashboard/absensi/attendance-client";
import { cleanupExpiredAttendancePhotos } from "@/lib/attendance-storage";
import { getTodaysScheduledAttendanceForUser } from "@/lib/attendance-schedule";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Absensi Anggota",
  description: "Absensi dengan kamera, jam, dan lokasi",
};

function toDateTimeString(value) {
  return new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AbsensiAnggotaPage() {
  const { session } = await requirePagePermission("attendance", "view");

  if (!prisma.attendanceRecord?.findMany) {
    return (
      <AttendanceClient
        history={[]}
        userName={session.user.fullName || session.user.email}
        initError="Model attendanceRecord belum siap. Jalankan: npm run prisma:generate && npm run prisma:push"
      />
    );
  }

  await cleanupExpiredAttendancePhotos();

  const scheduleContext = await getTodaysScheduledAttendanceForUser(session.user.id);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      attendedAt: "desc",
    },
    take: 20,
    select: {
      id: true,
      attendedAt: true,
      latitude: true,
      longitude: true,
      accuracy: true,
      locationLabel: true,
      photoPath: true,
      photoExpiresAt: true,
    },
  });

  const history = records.map((record) => ({
    id: record.id,
    attendedAt: toDateTimeString(record.attendedAt),
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy,
    locationLabel: record.locationLabel,
    photoUrl: record.photoPath ? `/api/dashboard/attendance/${record.id}/photo` : null,
    photoExpiresAt: record.photoExpiresAt ? toDateTimeString(record.photoExpiresAt) : null,
  }));

  return (
    <AttendanceClient
      history={history}
      userName={session.user.fullName || session.user.email}
      scheduleContext={scheduleContext}
    />
  );
}
