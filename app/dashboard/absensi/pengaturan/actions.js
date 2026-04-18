"use server";

import { revalidatePath } from "next/cache";

import { saveAttendanceSetting, validateAttendanceSetting } from "@/lib/attendance-settings";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function parsePriority(value) {
  const parsed = Number(String(value || "").trim());
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

async function requireManagePermission() {
  const { evaluator } = await requirePagePermission("attendance-settings", "update");

  if (!evaluator.isHighestPriority) {
    return { error: "Hanya role dengan prioritas tertinggi yang dapat mengubah setting absensi." };
  }

  return { success: true };
}

export async function saveAttendanceSettingAction(formData) {
  const { session } = await requirePagePermission("attendance-settings", "update");

  const permission = await requireManagePermission();
  if (permission.error) {
    return permission;
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

export async function createStandbyLocationAction(formData) {
  const permission = await requireManagePermission();
  if (permission.error) {
    return permission;
  }

  const delegate = prisma.attendanceLocation;
  if (!delegate?.create) {
    return { error: "Model AttendanceLocation belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const locationName = String(formData.get("locationName") || "").trim();
  const priority = parsePriority(formData.get("priority"));

  if (!locationName) {
    return { error: "Nama lokasi wajib diisi." };
  }

  if (priority === null) {
    return { error: "Priority lokasi harus angka bulat >= 0." };
  }

  const existing = await delegate.findFirst({
    where: {
      locationName,
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "Nama lokasi sudah ada." };
  }

  try {
    await delegate.create({
      data: {
        locationName,
        priority,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal menambah lokasi." };
  }

  revalidatePath("/dashboard/absensi/pengaturan");
  return { success: true };
}

export async function updateStandbyLocationAction(formData) {
  const permission = await requireManagePermission();
  if (permission.error) {
    return permission;
  }

  const delegate = prisma.attendanceLocation;
  if (!delegate?.update) {
    return { error: "Model AttendanceLocation belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const id = String(formData.get("id") || "").trim();
  const locationName = String(formData.get("locationName") || "").trim();
  const priority = parsePriority(formData.get("priority"));

  if (!id) {
    return { error: "ID lokasi tidak valid." };
  }

  if (!locationName) {
    return { error: "Nama lokasi wajib diisi." };
  }

  if (priority === null) {
    return { error: "Priority lokasi harus angka bulat >= 0." };
  }

  const current = await delegate.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    return { error: "Data lokasi tidak ditemukan." };
  }

  const duplicatedName = await delegate.findFirst({
    where: {
      locationName,
      id: {
        not: id,
      },
    },
    select: { id: true },
  });

  if (duplicatedName) {
    return { error: "Nama lokasi sudah ada." };
  }

  try {
    await delegate.update({
      where: { id },
      data: {
        locationName,
        priority,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal memperbarui lokasi." };
  }

  revalidatePath("/dashboard/absensi/pengaturan");
  return { success: true };
}

export async function deleteStandbyLocationAction(formData) {
  const permission = await requireManagePermission();
  if (permission.error) {
    return permission;
  }

  const delegate = prisma.attendanceLocation;
  if (!delegate?.delete) {
    return { error: "Model AttendanceLocation belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return { error: "ID lokasi tidak valid." };
  }

  try {
    await delegate.delete({ where: { id } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal menghapus lokasi." };
  }

  revalidatePath("/dashboard/absensi/pengaturan");
  return { success: true };
}
