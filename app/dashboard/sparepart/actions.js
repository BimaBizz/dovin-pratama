"use server";

import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const SPAREPART_STORAGE_ROOT = path.join(process.cwd(), "storage", "spareparts");

function isUploadFile(value) {
  return Boolean(value) && typeof value === "object" && typeof value.arrayBuffer === "function";
}

function parseQuantity(value) {
  const parsed = Number(String(value || "").trim());

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function getFileExtension(fileName) {
  const extension = path.extname(fileName || "").toLowerCase();
  return extension || ".bin";
}

async function deleteStoredFile(storagePath) {
  if (!storagePath) {
    return;
  }

  const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), storagePath.replace(/^\/+/, ""));

  try {
    await unlink(absolutePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function saveSparepartImageFile(sparepartId, file) {
  const directory = path.join(SPAREPART_STORAGE_ROOT, sparepartId);
  await mkdir(directory, { recursive: true });

  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${getFileExtension(file.name)}`;
  const relativePath = path.join("storage", "spareparts", sparepartId, safeName);
  const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, buffer);

  return {
    filePath: relativePath,
    fileName: file.name || safeName,
    mimeType: file.type || null,
  };
}

function getUploadedImages(formData) {
  const files = formData.getAll("images").filter(isUploadFile).filter((file) => file.size > 0);

  if (files.length > MAX_IMAGES) {
    return { error: `Maksimal ${MAX_IMAGES} gambar.` };
  }

  for (const file of files) {
    if (!String(file.type || "").startsWith("image/")) {
      return { error: "Semua file gambar harus berupa image." };
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { error: "Ukuran setiap gambar maksimal 4 MB." };
    }
  }

  return { files };
}

function parseRemoveImageIds(formData) {
  return Array.from(
    new Set(
      formData
        .getAll("removeImageIds")
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function ensureSparepartDelegate() {
  const sparepartDelegate = prisma.sparepart;
  const sparepartImageDelegate = prisma.sparepartImage;

  if (!sparepartDelegate?.findMany || !sparepartImageDelegate?.findMany) {
    return {
      error: "Model sparepart belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  return { sparepartDelegate, sparepartImageDelegate };
}

export async function createSparepartAction(formData) {
  await requirePagePermission("sparepart", "create");

  const delegates = ensureSparepartDelegate();
  if (delegates.error) {
    return { error: delegates.error };
  }

  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const quantity = parseQuantity(formData.get("quantity"));
  const uploads = getUploadedImages(formData);

  if (!name) {
    return { error: "Nama sparepart wajib diisi." };
  }

  if (!location) {
    return { error: "Lokasi sparepart wajib diisi." };
  }

  if (quantity === null) {
    return { error: "Jumlah barang harus berupa angka bulat >= 0." };
  }

  if (uploads.error) {
    return { error: uploads.error };
  }

  const savedPaths = [];

  try {
    const sparepart = await delegates.sparepartDelegate.create({
      data: {
        name,
        location,
        quantity,
        description: description || null,
      },
      select: { id: true },
    });

    for (let index = 0; index < uploads.files.length; index += 1) {
      const file = uploads.files[index];
      const stored = await saveSparepartImageFile(sparepart.id, file);
      savedPaths.push(stored.filePath);

      await delegates.sparepartImageDelegate.create({
        data: {
          sparepartId: sparepart.id,
          filePath: stored.filePath,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          sortOrder: index,
        },
      });
    }
  } catch (error) {
    for (const savedPath of savedPaths) {
      await deleteStoredFile(savedPath);
    }

    return { error: error instanceof Error ? error.message : "Gagal menambahkan sparepart." };
  }

  revalidatePath("/dashboard/sparepart");
  return { success: true };
}

export async function updateSparepartAction(formData) {
  await requirePagePermission("sparepart", "update");

  const delegates = ensureSparepartDelegate();
  if (delegates.error) {
    return { error: delegates.error };
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const quantity = parseQuantity(formData.get("quantity"));
  const uploads = getUploadedImages(formData);
  const removeImageIds = parseRemoveImageIds(formData);

  if (!id) {
    return { error: "ID sparepart tidak valid." };
  }

  if (!name) {
    return { error: "Nama sparepart wajib diisi." };
  }

  if (!location) {
    return { error: "Lokasi sparepart wajib diisi." };
  }

  if (quantity === null) {
    return { error: "Jumlah barang harus berupa angka bulat >= 0." };
  }

  if (uploads.error) {
    return { error: uploads.error };
  }

  const sparepart = await delegates.sparepartDelegate.findUnique({
    where: { id },
    select: {
      id: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          filePath: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!sparepart) {
    return { error: "Data sparepart tidak ditemukan." };
  }

  const removeSet = new Set(removeImageIds);
  const imagesToRemove = sparepart.images.filter((image) => removeSet.has(image.id));
  const remainingImages = sparepart.images.filter((image) => !removeSet.has(image.id));

  if (remainingImages.length + uploads.files.length > MAX_IMAGES) {
    return { error: `Total gambar maksimal ${MAX_IMAGES}.` };
  }

  const savedPaths = [];

  try {
    await delegates.sparepartDelegate.update({
      where: { id },
      data: {
        name,
        location,
        quantity,
        description: description || null,
      },
    });

    if (imagesToRemove.length > 0) {
      await delegates.sparepartImageDelegate.deleteMany({
        where: {
          id: {
            in: imagesToRemove.map((image) => image.id),
          },
          sparepartId: id,
        },
      });

      for (const image of imagesToRemove) {
        await deleteStoredFile(image.filePath);
      }
    }

    const currentCount = remainingImages.length;
    for (let index = 0; index < uploads.files.length; index += 1) {
      const file = uploads.files[index];
      const stored = await saveSparepartImageFile(id, file);
      savedPaths.push(stored.filePath);

      await delegates.sparepartImageDelegate.create({
        data: {
          sparepartId: id,
          filePath: stored.filePath,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          sortOrder: currentCount + index,
        },
      });
    }

    const refreshedImages = await delegates.sparepartImageDelegate.findMany({
      where: { sparepartId: id },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    for (let index = 0; index < refreshedImages.length; index += 1) {
      await delegates.sparepartImageDelegate.update({
        where: { id: refreshedImages[index].id },
        data: { sortOrder: index },
      });
    }
  } catch (error) {
    for (const savedPath of savedPaths) {
      await deleteStoredFile(savedPath);
    }

    return { error: error instanceof Error ? error.message : "Gagal memperbarui sparepart." };
  }

  revalidatePath("/dashboard/sparepart");
  revalidatePath(`/dashboard/sparepart/${id}`);
  return { success: true };
}

export async function deleteSparepartAction(formData) {
  await requirePagePermission("sparepart", "delete");

  const delegates = ensureSparepartDelegate();
  if (delegates.error) {
    return { error: delegates.error };
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    return { error: "ID sparepart tidak valid." };
  }

  const sparepart = await delegates.sparepartDelegate.findUnique({
    where: { id },
    select: {
      id: true,
      images: {
        select: {
          filePath: true,
        },
      },
    },
  });

  if (!sparepart) {
    return { error: "Data sparepart tidak ditemukan." };
  }

  await delegates.sparepartDelegate.delete({ where: { id } });

  for (const image of sparepart.images) {
    await deleteStoredFile(image.filePath);
  }

  revalidatePath("/dashboard/sparepart");
  return { success: true };
}
