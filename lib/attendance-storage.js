import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";

const ATTENDANCE_TMP_DIR = path.join(process.cwd(), "tmp", "attendance");
const ATTENDANCE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;

function getExtensionFromMimeType(mimeType) {
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  return ".bin";
}

export function buildAttendancePhotoAbsolutePath(photoPath) {
  return path.join(process.cwd(), photoPath.replace(/^\/+/, ""));
}

export async function saveAttendancePhoto({ userId, file }) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Foto absensi tidak valid.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("File foto harus berupa gambar.");
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error("Ukuran foto maksimal 4 MB.");
  }

  await mkdir(ATTENDANCE_TMP_DIR, { recursive: true });

  const extension = getExtensionFromMimeType(file.type);
  const filename = `${Date.now()}-${userId}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  const relativePath = path.join("tmp", "attendance", filename);
  const absolutePath = buildAttendancePhotoAbsolutePath(relativePath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    photoPath: relativePath,
    photoMimeType: file.type,
    photoExpiresAt: new Date(Date.now() + ATTENDANCE_TTL_MS),
  };
}

export async function readAttendancePhoto(photoPath) {
  const absolutePath = buildAttendancePhotoAbsolutePath(photoPath);
  return readFile(absolutePath);
}

export async function cleanupExpiredAttendancePhotos() {
  const now = new Date();
  const expiredRecords = await prisma.attendanceRecord.findMany({
    where: {
      photoPath: { not: null },
      photoExpiresAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      photoPath: true,
    },
    take: 200,
  });

  for (const record of expiredRecords) {
    if (record.photoPath) {
      const absolutePath = buildAttendancePhotoAbsolutePath(record.photoPath);
      try {
        await unlink(absolutePath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }

    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        photoPath: null,
        photoMimeType: null,
        photoExpiresAt: null,
      },
    });
  }

  return expiredRecords.length;
}
