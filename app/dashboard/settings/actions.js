"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateOwnProfileAction(formData) {
  const session = await requireAuthenticatedUser();

  const fullName = String(formData.get("fullName") || "").trim();
  const birthPlace = String(formData.get("birthPlace") || "").trim();
  const birthDateRaw = String(formData.get("birthDate") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!fullName || !birthPlace || !birthDateRaw || !address || !email) {
    return { error: "Nama lengkap, tempat lahir, tanggal lahir, alamat, dan email wajib diisi." };
  }

  const birthDate = new Date(birthDateRaw);
  if (Number.isNaN(birthDate.getTime())) {
    return { error: "Tanggal lahir tidak valid." };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!currentUser) {
    return { error: "User tidak ditemukan." };
  }

  const duplicateEmail = await prisma.user.findFirst({
    where: {
      email,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });

  if (duplicateEmail) {
    return { error: "Email sudah digunakan user lain." };
  }

  const data = {
    fullName,
    birthPlace,
    birthDate,
    address,
    email,
  };

  if (password) {
    data.passwordHash = await hash(password, 12);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: true };
}