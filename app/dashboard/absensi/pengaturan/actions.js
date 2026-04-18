"use server";

import { revalidatePath } from "next/cache";

import { saveAttendanceSetting, validateAttendanceSetting } from "@/lib/attendance-settings";
import { requirePagePermission } from "@/lib/permissions";

export async function saveAttendanceSettingAction(formData) {
  const { session, evaluator } = await requirePagePermission("attendance-settings", "update");

  if (!evaluator.isHighestPriority) {
    return { error: "Hanya role dengan prioritas tertinggi yang dapat mengubah setting absensi." };
  }

  const configRaw = String(formData.get("configJson") || "").trim();

  if (!configRaw) {
    return { error: "Payload setting absensi kosong." };
  }

  let parsed;
  try {
    parsed = JSON.parse(configRaw);
  } catch {
    return { error: "Format JSON setting absensi tidak valid." };
  }

  const validation = validateAttendanceSetting(parsed);
  if (validation.error) {
    return { error: validation.error };
  }

  const saved = await saveAttendanceSetting({
    config: parsed,
    updatedByUserId: session.user.id,
  });

  if (saved.error) {
    return { error: saved.error };
  }

  revalidatePath("/dashboard/absensi");
  revalidatePath("/dashboard/absensi/pengaturan");

  return { success: true };
}
