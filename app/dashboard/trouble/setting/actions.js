"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getTroubleUnitDelegate() {
  return prisma.troubleUnit;
}

function getTroubleRecordDelegate() {
  return prisma.troubleRecord;
}

export async function createTroubleUnitAction(formData) {
  await requirePagePermission("trouble-setting", "create");

  const name = String(formData.get("name") || "").trim();

  if (!name) {
    return { error: "Nama unit wajib diisi." };
  }

  const unitDelegate = getTroubleUnitDelegate();
  if (!unitDelegate?.create) {
    return { error: "Model TroubleUnit belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const duplicate = await unitDelegate.findFirst({ where: { name } });
  if (duplicate) {
    return { error: "Nama unit sudah digunakan." };
  }

  await unitDelegate.create({ data: { name } });

  revalidatePath("/dashboard/trouble/setting");
  revalidatePath("/dashboard/trouble/unit-trouble");
  return { success: true };
}

export async function updateTroubleUnitAction(formData) {
  await requirePagePermission("trouble-setting", "update");

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!id) {
    return { error: "ID unit tidak valid." };
  }

  if (!name) {
    return { error: "Nama unit wajib diisi." };
  }

  const unitDelegate = getTroubleUnitDelegate();
  if (!unitDelegate?.findUnique || !unitDelegate?.update) {
    return { error: "Model TroubleUnit belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const currentUnit = await unitDelegate.findUnique({ where: { id } });
  if (!currentUnit) {
    return { error: "Data unit tidak ditemukan." };
  }

  const duplicate = await unitDelegate.findFirst({
    where: {
      name,
      NOT: { id },
    },
  });

  if (duplicate) {
    return { error: "Nama unit sudah digunakan." };
  }

  await unitDelegate.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/dashboard/trouble/setting");
  revalidatePath("/dashboard/trouble/unit-trouble");
  return { success: true };
}

export async function deleteTroubleUnitAction(formData) {
  await requirePagePermission("trouble-setting", "delete");

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    return { error: "ID unit tidak valid." };
  }

  const unitDelegate = getTroubleUnitDelegate();
  const recordDelegate = getTroubleRecordDelegate();

  if (!unitDelegate?.findUnique || !unitDelegate?.delete) {
    return { error: "Model TroubleUnit belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  if (!recordDelegate?.count) {
    return { error: "Model TroubleRecord belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const currentUnit = await unitDelegate.findUnique({ where: { id } });
  if (!currentUnit) {
    return { error: "Data unit tidak ditemukan." };
  }

  const usageCount = await recordDelegate.count({ where: { unitId: id } });
  if (usageCount > 0) {
    return { error: "Unit masih dipakai data trouble, jadi tidak bisa dihapus." };
  }

  await unitDelegate.delete({ where: { id } });

  revalidatePath("/dashboard/trouble/setting");
  revalidatePath("/dashboard/trouble/unit-trouble");
  return { success: true };
}