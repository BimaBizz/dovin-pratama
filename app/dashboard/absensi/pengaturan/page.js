import { getAttendanceSetting } from "@/lib/attendance-settings";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import AttendanceSettingClient from "@/app/dashboard/absensi/pengaturan/attendance-setting-client";

export const metadata = {
  title: "Pengaturan Absensi",
  description: "Setting window waktu absensi berdasarkan shift tim",
};

export default async function AttendanceSettingPage() {
  const { evaluator } = await requirePagePermission("attendance-settings", "view");
  const setting = await getAttendanceSetting();

  const locationDelegate = prisma.attendanceLocation;
  let locationInitError = "";
  let locations = [];

  if (!locationDelegate?.findMany) {
    locationInitError = "Model AttendanceLocation belum siap. Jalankan: npm run prisma:generate && npm run prisma:push";
  } else {
    locations = await locationDelegate.findMany({
      orderBy: [{ priority: "asc" }, { locationName: "asc" }],
      select: {
        id: true,
        locationName: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return (
    <AttendanceSettingClient
      initialSetting={setting}
      locations={locations}
      locationInitError={locationInitError}
      canManage={evaluator.isHighestPriority && evaluator.canCrud("attendance-settings", "update")}
      viewerRolePriority={evaluator.rolePriority}
      maxPriority={evaluator.maxPriority}
    />
  );
}
