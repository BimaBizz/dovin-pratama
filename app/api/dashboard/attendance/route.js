import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { cleanupExpiredAttendancePhotos, saveAttendancePhoto } from "@/lib/attendance-storage";
import { getTodaysScheduledAttendanceForUser } from "@/lib/attendance-schedule";
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from "@/lib/attendance-status";
import { prisma } from "@/lib/prisma";

function parseNumber(value) {
  const parsed = Number(String(value || "").trim());
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function parseAttendanceStatus(value) {
  return normalizeAttendanceStatus(value);
}

/**
 * Fire-and-forget: jalankan cleanup foto expired tanpa menunggu hasilnya.
 * Ini menghindari blocking request absensi hanya untuk menghapus file lama.
 * Hanya dijalankan dengan probabilitas 10% untuk mengurangi beban per-request.
 */
function schedulePhotoCleanup() {
  // Hanya jalankan cleanup 10% dari waktu untuk mengurangi beban
  if (Math.random() > 0.1) {
    return;
  }

  cleanupExpiredAttendancePhotos().catch((error) => {
    console.error("[attendance-cleanup] Error:", error?.message || error);
  });
}

export async function POST(request) {
  const session = await getCurrentSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!prisma.attendanceRecord?.create) {
    return new NextResponse("Model attendanceRecord belum siap. Jalankan: npm run prisma:generate && npm run prisma:push", {
      status: 500,
    });
  }

  const formData = await request.formData();
  const latitude = parseNumber(formData.get("latitude"));
  const longitude = parseNumber(formData.get("longitude"));
  const accuracy = parseNumber(formData.get("accuracy"));
  const locationLabel = String(formData.get("locationLabel") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const attendanceStatus = parseAttendanceStatus(formData.get("attendanceStatus"));
  const photo = formData.get("photo");

  const scheduledAttendance = await getTodaysScheduledAttendanceForUser(session.user.id);
  if (scheduledAttendance.error) {
    return new NextResponse(scheduledAttendance.error, { status: 400 });
  }

  if (attendanceStatus === ATTENDANCE_STATUS.PRESENT && !scheduledAttendance.allowed) {
    return new NextResponse(scheduledAttendance.message || "Absensi belum dapat dilakukan pada waktu ini.", {
      status: 400,
    });
  }

  if (scheduledAttendance.alreadyAttended) {
    return new NextResponse("Absensi untuk jadwal ini sudah pernah dilakukan.", { status: 400 });
  }

  if (attendanceStatus !== ATTENDANCE_STATUS.PRESENT) {
    if (!note) {
      return new NextResponse("Keterangan wajib diisi untuk cuti atau sakit.", { status: 400 });
    }

    const attendance = await prisma.attendanceRecord.create({
      data: {
        userId: session.user.id,
        scheduleAssignmentId: scheduledAttendance.assignment.id,
        status: attendanceStatus,
        note,
        attendedAt: new Date(),
        latitude: null,
        longitude: null,
        accuracy: null,
        locationLabel: null,
        photoPath: null,
        photoMimeType: null,
        photoExpiresAt: null,
      },
      select: {
        id: true,
        attendedAt: true,
        status: true,
      },
    });

    // Non-blocking cleanup — tidak menunggu hasilnya
    schedulePhotoCleanup();

    return NextResponse.json({
      success: true,
      attendance,
    });
  }

  if (latitude === null || longitude === null) {
    return new NextResponse("Lokasi absensi tidak valid.", { status: 400 });
  }

  let photoPayload = {
    photoPath: null,
    photoMimeType: null,
    photoExpiresAt: null,
  };

  try {
    photoPayload = await saveAttendancePhoto({
      userId: session.user.id,
      file: photo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan foto absensi.";
    return new NextResponse(message, { status: 400 });
  }

  const attendance = await prisma.attendanceRecord.create({
    data: {
      userId: session.user.id,
      scheduleAssignmentId: scheduledAttendance.assignment.id,
      status: ATTENDANCE_STATUS.PRESENT,
      latitude,
      longitude,
      accuracy: accuracy === null ? null : accuracy,
      locationLabel: locationLabel || null,
      note: null,
      attendedAt: new Date(),
      ...photoPayload,
    },
    select: {
      id: true,
      attendedAt: true,
      status: true,
    },
  });

  // Non-blocking cleanup — tidak menunggu hasilnya
  schedulePhotoCleanup();

  return NextResponse.json({
    success: true,
    attendance,
  });
}
