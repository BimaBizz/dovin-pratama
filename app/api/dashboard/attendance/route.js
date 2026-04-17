import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { cleanupExpiredAttendancePhotos, saveAttendancePhoto } from "@/lib/attendance-storage";
import { prisma } from "@/lib/prisma";

function parseNumber(value) {
  const parsed = Number(String(value || "").trim());
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
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
  const photo = formData.get("photo");

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
      latitude,
      longitude,
      accuracy: accuracy === null ? null : accuracy,
      locationLabel: locationLabel || null,
      ...photoPayload,
    },
    select: {
      id: true,
      attendedAt: true,
    },
  });

  await cleanupExpiredAttendancePhotos();

  return NextResponse.json({
    success: true,
    attendance,
  });
}
