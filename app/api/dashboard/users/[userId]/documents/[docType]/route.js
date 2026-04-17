import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const documentMap = {
  ktp: { pathKey: "ktpPath", nameKey: "ktpName" },
  kk: { pathKey: "kkPath", nameKey: "kkName" },
  ijazah: { pathKey: "ijazahPath", nameKey: "ijazahName" },
  skck: { pathKey: "skckPath", nameKey: "skckName" },
};

function getContentType(filePath) {
  const extension = path.extname(filePath || "").toLowerCase();

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

export async function GET(request, { params }) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "SUPERUSER") {
    return new Response("Unauthorized", { status: 401 });
  }

  const resolvedParams = await params;
  const userId = String(resolvedParams?.userId || "").trim();
  const docType = String(resolvedParams?.docType || "").trim().toLowerCase();
  const documentConfig = documentMap[docType];

  if (!userId || !documentConfig) {
    return new Response("Dokumen tidak ditemukan", { status: 404 });
  }

  const userDocument = await prisma.userDocument.findUnique({
    where: { userId },
    select: {
      [documentConfig.pathKey]: true,
      [documentConfig.nameKey]: true,
    },
  });

  const storagePath = userDocument?.[documentConfig.pathKey];
  const fileName = userDocument?.[documentConfig.nameKey] || `${docType}.bin`;

  if (!storagePath) {
    return new Response("Dokumen tidak ditemukan", { status: 404 });
  }

  const absolutePath = path.join(process.cwd(), storagePath.replace(/^\//, ""));

  let fileBuffer;
  try {
    fileBuffer = await readFile(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return new Response("Dokumen tidak ditemukan", { status: 404 });
    }

    throw error;
  }

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": getContentType(storagePath),
      "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}