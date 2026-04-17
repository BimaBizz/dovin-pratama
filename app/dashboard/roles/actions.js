"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function ensureRoleDelegate() {
  const roleDelegate = prisma.roleEntry;

  if (!roleDelegate) {
    return {
      error: "Model role belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  return { roleDelegate };
}

export async function createRoleAction(formData) {
  await requirePagePermission("roles", "create");

  const delegate = ensureRoleDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const name = String(formData.get("name") || "").trim().toUpperCase();

  if (!name) {
    return { error: "Nama role wajib diisi." };
  }

  const existing = await delegate.roleDelegate.findUnique({ where: { name } });
  if (existing) {
    return { error: "Nama role sudah ada." };
  }

  await delegate.roleDelegate.create({
    data: {
      name,
    },
  });

  revalidatePath("/dashboard/roles");
  return { success: true };
}

export async function updateRoleAction(formData) {
  await requirePagePermission("roles", "update");

  const delegate = ensureRoleDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim().toUpperCase();

  if (!id) {
    return { error: "ID role tidak valid." };
  }

  if (!name) {
    return { error: "Nama role wajib diisi." };
  }

  const duplicate = await delegate.roleDelegate.findFirst({
    where: {
      name,
      NOT: { id },
    },
  });

  if (duplicate) {
    return { error: "Nama role sudah digunakan." };
  }

  await delegate.roleDelegate.update({
    where: { id },
    data: {
      name,
    },
  });

  revalidatePath("/dashboard/roles");
  return { success: true };
}

export async function deleteRoleAction(formData) {
  await requirePagePermission("roles", "delete");

  const delegate = ensureRoleDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return { error: "ID role tidak valid." };
  }

  await delegate.roleDelegate.delete({ where: { id } });

  revalidatePath("/dashboard/roles");
  return { success: true };
}
