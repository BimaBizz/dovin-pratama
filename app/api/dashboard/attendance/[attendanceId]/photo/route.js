import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { cleanupExpiredAttendancePhotos, readAttendancePhoto } from "@/lib/attendance-storage";
import { prisma } from "@/lib/prisma";

export async function GET(_request, { params }) {
  const session = await getCurrentSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await cleanupExpiredAttendancePhotos();

  const resolvedParams = await params;
  const attendanceId = String(resolvedParams?.attendanceId || "").trim();

  if (!attendanceId) {
    return new NextResponse("Data absensi tidak valid.", { status: 400 });
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: {
      id: attendanceId,
    },
    select: {
      userId: true,
      photoPath: true,
      photoMimeType: true,
    },
  });

  if (!record || !record.photoPath) {
    return new NextResponse("Foto tidak ditemukan.", { status: 404 });
  }

  const canAccess = session.user.role === "SUPERUSER" || session.user.id === record.userId;
  if (!canAccess) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buffer = await readAttendancePhoto(record.photoPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": record.photoMimeType || "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return new NextResponse("Foto tidak ditemukan.", { status: 404 });
    }

    throw error;
  }
}
