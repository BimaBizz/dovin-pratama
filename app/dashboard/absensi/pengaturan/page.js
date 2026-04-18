import { getAttendanceSetting } from "@/lib/attendance-settings";
import { requirePagePermission } from "@/lib/permissions";

import AttendanceSettingClient from "@/app/dashboard/absensi/pengaturan/attendance-setting-client";

export const metadata = {
  title: "Pengaturan Absensi",
  description: "Setting window waktu absensi berdasarkan shift tim",
};

export default async function AttendanceSettingPage() {
  const { evaluator } = await requirePagePermission("attendance-settings", "view");
  const setting = await getAttendanceSetting();

  return (
    <AttendanceSettingClient
      initialSetting={setting}
      canManage={evaluator.isHighestPriority && evaluator.canCrud("attendance-settings", "update")}
      viewerRolePriority={evaluator.rolePriority}
      maxPriority={evaluator.maxPriority}
    />
  );
}
