"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCurrentSession, requireSuperuser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024;
const UPLOAD_ROOT = path.join(process.cwd(), "storage", "users");

const documentFields = [
  { key: "ktp", label: "KTP" },
  { key: "kk", label: "KK" },
  { key: "ijazah", label: "Ijasah" },
  { key: "skck", label: "SKCK" },
];

function isUploadFile(value) {
  return Boolean(value) && typeof value === "object" && typeof value.arrayBuffer === "function";
}

function getFileExtension(fileName) {
  const extension = path.extname(fileName || "").toLowerCase();
  return extension || ".bin";
}

function getDocumentStoragePath(userId, key, fileName) {
  return path.join("storage", "users", userId, `${key}${getFileExtension(fileName)}`);
}

async function saveDocumentFile(userId, key, file) {
  const directory = path.join(UPLOAD_ROOT, userId);
  await mkdir(directory, { recursive: true });

  const storagePath = getDocumentStoragePath(userId, key, file.name);
  const absolutePath = path.join(process.cwd(), storagePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, buffer);

  return storagePath;
}

async function deleteStoredFile(storagePath) {
  if (!storagePath) {
    return;
  }

  const absolutePath = path.join(process.cwd(), storagePath.replace(/^\//, ""));

  try {
    await unlink(absolutePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return;
    }
  }
}

function collectDocumentUploads(formData) {
  const uploads = {};

  for (const field of documentFields) {
    const value = formData.get(field.key);

    if (!isUploadFile(value) || value.size === 0) {
      continue;
    }

    if (value.size > MAX_DOCUMENT_SIZE_BYTES) {
      return { error: `${field.label} maksimal 2 MB.` };
    }

    uploads[field.key] = value;
  }

  return { uploads };
}

async function syncUserDocuments(userId, uploads, existingDocument) {
  const documentData = {};
  const savedFiles = [];
  const replacedFiles = [];

  try {
    for (const field of documentFields) {
      const file = uploads[field.key];

      if (!file) {
        continue;
      }

      const storagePath = await saveDocumentFile(userId, field.key, file);
      const nameKey = `${field.key}Name`;
      const pathKey = `${field.key}Path`;

      documentData[pathKey] = storagePath;
      documentData[nameKey] = file.name;
      savedFiles.push(storagePath);

      const previousPath = existingDocument?.[pathKey];
      if (previousPath && previousPath !== storagePath) {
        replacedFiles.push(previousPath);
      }
    }

    if (Object.keys(documentData).length === 0) {
      return { success: true };
    }

    if (existingDocument) {
      await prisma.userDocument.update({
        where: { userId },
        data: documentData,
      });
    } else {
      await prisma.userDocument.create({
        data: {
          userId,
          ...documentData,
        },
      });
    }

    for (const storagePath of replacedFiles) {
      await deleteStoredFile(storagePath);
    }

    return { success: true };
  } catch (error) {
    for (const storagePath of savedFiles) {
      await deleteStoredFile(storagePath);
    }

    throw error;
  }
}

async function ensureRoleExistsInMaster(role) {
  const roleDelegate = prisma.roleEntry;

  if (!roleDelegate) {
    return {
      error: "Model role belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  const roleEntry = await roleDelegate.findUnique({ where: { name: role } });

  if (!roleEntry) {
    return { error: "Role tidak ditemukan di master role." };
  }

  return { success: true };
}

export async function createUserAction(formData) {
  await requireSuperuser();

  const fullName = String(formData.get("fullName") || "").trim();
  const birthPlace = String(formData.get("birthPlace") || "").trim();
  const birthDateRaw = String(formData.get("birthDate") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "").trim();

  if (!fullName || !birthPlace || !birthDateRaw || !address || !email || !password) {
    return { error: "Data profil, email, dan password wajib diisi." };
  }

  if (!role) {
    return { error: "Role tidak valid." };
  }

  const documentUploads = collectDocumentUploads(formData);
  if (documentUploads.error) {
    return { error: documentUploads.error };
  }

  const birthDate = new Date(birthDateRaw);
  if (Number.isNaN(birthDate.getTime())) {
    return { error: "Tanggal lahir tidak valid." };
  }

  const roleCheck = await ensureRoleExistsInMaster(role);
  if (roleCheck.error) {
    return { error: roleCheck.error };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "Email sudah terdaftar." };
  }

  const passwordHash = await hash(password, 12);

  const createdUser = await prisma.user.create({
    data: {
      fullName,
      birthPlace,
      birthDate,
      address,
      email,
      passwordHash,
      role,
    },
  });

  try {
    await syncUserDocuments(createdUser.id, documentUploads.uploads, null);
  } catch (error) {
    await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => undefined);
    return { error: error instanceof Error ? error.message : "Gagal menyimpan dokumen user." };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function updateUserAction(formData) {
  await requireSuperuser();

  const id = String(formData.get("id") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const birthPlace = String(formData.get("birthPlace") || "").trim();
  const birthDateRaw = String(formData.get("birthDate") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const documentUploads = collectDocumentUploads(formData);

  if (!id) {
    return { error: "ID user tidak valid." };
  }

  if (!email) {
    return { error: "Email wajib diisi." };
  }

  if (!fullName || !birthPlace || !birthDateRaw || !address) {
    return { error: "Data profil wajib diisi." };
  }

  if (!role) {
    return { error: "Role tidak valid." };
  }

  if (documentUploads.error) {
    return { error: documentUploads.error };
  }

  const birthDate = new Date(birthDateRaw);
  if (Number.isNaN(birthDate.getTime())) {
    return { error: "Tanggal lahir tidak valid." };
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { error: "User tidak ditemukan." };
  }

  const existingDocument = await prisma.userDocument.findUnique({
    where: { userId: id },
  });

  if (role !== user.role) {
    const roleCheck = await ensureRoleExistsInMaster(role);
    if (roleCheck.error) {
      return { error: roleCheck.error };
    }
  }

  const duplicate = await prisma.user.findFirst({
    where: {
      email,
      NOT: { id },
    },
  });

  if (duplicate) {
    return { error: "Email sudah digunakan user lain." };
  }

  const data = {
    fullName,
    birthPlace,
    birthDate,
    address,
    email,
    role,
  };

  if (password) {
    data.passwordHash = await hash(password, 12);
  }

  await prisma.user.update({ where: { id }, data });

  try {
    await syncUserDocuments(id, documentUploads.uploads, existingDocument);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal menyimpan dokumen user." };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function deleteUserAction(formData) {
  await requireSuperuser();

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return { error: "ID user tidak valid." };
  }

  const session = await getCurrentSession();
  if (session?.user?.id === id) {
    return { error: "Tidak bisa menghapus user yang sedang login." };
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      userDocument: {
        select: {
          ktpPath: true,
          kkPath: true,
          ijazahPath: true,
          skckPath: true,
        },
      },
    },
  });

  if (!user) {
    return { error: "User tidak ditemukan." };
  }

  if (user.role === "SUPERUSER") {
    return { error: "User dengan role SUPERUSER tidak bisa dihapus." };
  }

  await prisma.user.delete({ where: { id } });

  const documentPaths = user.userDocument
    ? [user.userDocument.ktpPath, user.userDocument.kkPath, user.userDocument.ijazahPath, user.userDocument.skckPath]
    : [];

  for (const storagePath of documentPaths) {
    await deleteStoredFile(storagePath);
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}
