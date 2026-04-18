import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request, { params }) {
  await requireAuthenticatedUser();

  const resolvedParams = await params;
  const imageId = String(resolvedParams?.imageId || "").trim();

  if (!imageId) {
    return new NextResponse("ID gambar tidak valid", { status: 400 });
  }

  const image = await prisma.sparepartImage.findUnique({
    where: { id: imageId },
    select: {
      filePath: true,
      mimeType: true,
    },
  });

  if (!image?.filePath) {
    return new NextResponse("Gambar tidak ditemukan", { status: 404 });
  }

  const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), image.filePath.replace(/^\/+/, ""));

  try {
    const buffer = await readFile(absolutePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": image.mimeType || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return new NextResponse("File gambar tidak ditemukan", { status: 404 });
    }

    throw error;
  }
}
