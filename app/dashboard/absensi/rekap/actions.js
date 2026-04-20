"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const ATTENDANCE_STATUSES = new Set(["PRESENT", "SICK", "LEAVE"]);

function parseTimeToUtcDate(sourceDate, timeText) {
  const match = String(timeText || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const year = sourceDate.getUTCFullYear();
  const month = sourceDate.getUTCMonth();
  const day = sourceDate.getUTCDate();

  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
}

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

export async function updateAttendanceRecapRecordAction(formData) {
  const { evaluator } = await requirePagePermission("attendance-recap", "view");

  if (!evaluator.canCrud("attendance-recap", "update")) {
    return { error: "Anda tidak memiliki akses edit rekap absensi." };
  }

  const attendanceRecordId = String(formData.get("attendanceRecordId") || "").trim();
  const status = String(formData.get("status") || "").trim().toUpperCase();
  const attendedTime = String(formData.get("attendedTime") || "").trim();

  if (!attendanceRecordId) {
    return { error: "Data absensi tidak valid." };
  }

  if (!ATTENDANCE_STATUSES.has(status)) {
    return { error: "Status absensi tidak valid." };
  }

  const attendanceRecord = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    select: { id: true, attendedAt: true },
  });

  if (!attendanceRecord) {
    return { error: "Record absensi tidak ditemukan." };
  }

  if (!attendanceRecord.attendedAt) {
    return { error: "Jam absensi belum tersedia pada record ini." };
  }

  const updatedAttendedAt = parseTimeToUtcDate(attendanceRecord.attendedAt, attendedTime);
  if (!updatedAttendedAt) {
    return { error: "Format jam absensi tidak valid." };
  }

  try {
    await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        status,
        attendedAt: updatedAttendedAt,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal memperbarui data absensi." };
  }

  revalidatePath("/dashboard/absensi/rekap");
  return { success: true };
}
