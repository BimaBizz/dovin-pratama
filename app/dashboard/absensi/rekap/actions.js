"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function updateAttendanceGuardLocationAction(formData) {
  await requirePagePermission("attendance-recap", "view");

  const attendanceRecordId = String(formData.get("attendanceRecordId") || "").trim();
  const locationLabel = String(formData.get("locationLabel") || "").trim();

  if (!attendanceRecordId) {
    return { error: "Data absensi tidak valid." };
  }

  const locationDelegate = prisma.attendanceLocation;
  if (!locationDelegate?.findUnique) {
    return { error: "Model AttendanceLocation belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  if (!locationLabel) {
    return { error: "Lokasi jaga wajib dipilih." };
  }

  const location = await locationDelegate.findUnique({
    where: { locationName: locationLabel },
    select: { id: true },
  });

  if (!location) {
    return { error: "Lokasi jaga tidak ditemukan di master lokasi." };
  }

  const attendanceRecord = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    select: { id: true },
  });

  if (!attendanceRecord) {
    return { error: "Record absensi tidak ditemukan." };
  }

  try {
    await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        locationLabel,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal menyimpan lokasi jaga." };
  }

  revalidatePath("/dashboard/absensi/rekap");
  return { success: true };
}
