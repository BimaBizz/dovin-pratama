"use server";

import { revalidatePath } from "next/cache";

import { saveAccessControlConfig, validateAccessControlConfig } from "@/lib/access-control-config";
import { requirePagePermission } from "@/lib/permissions";

export async function saveMasterPermissionAction(formData) {
  const { session, evaluator } = await requirePagePermission("permissions-master", "update");

  if (!evaluator.isHighestPriority) {
    return { error: "Hanya role dengan prioritas tertinggi yang dapat mengubah master permission." };
  }

  const configRaw = String(formData.get("configJson") || "").trim();

  if (!configRaw) {
    return { error: "Payload konfigurasi kosong." };
  }

  let parsed;
  try {
    parsed = JSON.parse(configRaw);
  } catch {
    return { error: "Format JSON konfigurasi tidak valid." };
  }

  const validation = validateAccessControlConfig(parsed);
  if (validation.error) {
    return { error: validation.error };
  }

  const saved = await saveAccessControlConfig({
    config: parsed,
    updatedByUserId: session.user.id,
  });

  if (saved.error) {
    return { error: saved.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/roles/master-permission");

  return { success: true };
}