"use server";

import { revalidatePath } from "next/cache";

import { requireSuperuser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHIFT_VALUES } from "@/app/dashboard/management/kelola-tim/constants";

function ensureScheduleDelegate() {
  const scheduleDelegate = prisma.teamScheduleAssignment;

  if (!scheduleDelegate?.findMany) {
    return {
      error: "Model teamScheduleAssignment belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  return { scheduleDelegate };
}

function getMonthDays(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return [];
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
  });
}

function parseEntries(formData) {
  const teamId = String(formData.get("teamId") || "").trim();
  const month = String(formData.get("month") || "").trim();
  const entriesRaw = String(formData.get("entries") || "").trim();

  if (!teamId) {
    return { error: "Tim wajib dipilih." };
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "Periode bulan tidak valid." };
  }

  let entries;
  try {
    entries = JSON.parse(entriesRaw);
  } catch {
    return { error: "Format jadwal tidak valid." };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return { error: "Data jadwal kosong." };
  }

  const normalizedEntries = entries.map((entry) => ({
    userId: String(entry?.userId || "").trim(),
    workDate: String(entry?.workDate || "").trim(),
    shiftCode: String(entry?.shiftCode || "").trim(),
  }));

  const invalidEntry = normalizedEntries.find(
    (entry) =>
      !entry.userId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.workDate) ||
      (entry.shiftCode && !SHIFT_VALUES.includes(entry.shiftCode))
  );

  if (invalidEntry) {
    return { error: "Ada baris jadwal dengan data user, tanggal, atau shift tidak valid." };
  }

  return {
    teamId,
    month,
    entries: normalizedEntries,
  };
}

export async function saveTeamScheduleGridAction(formData) {
  await requireSuperuser();

  const delegate = ensureScheduleDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const payload = parseEntries(formData);
  if (payload.error) {
    return { error: payload.error };
  }

  const team = await prisma.team.findUnique({
    where: { id: payload.teamId },
    select: {
      id: true,
      leaderId: true,
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!team) {
    return { error: "Tim tidak ditemukan." };
  }

  const monthDays = getMonthDays(payload.month);
  const monthDaySet = new Set(monthDays);

  const allowedUserIds = new Set([
    team.leaderId,
    ...team.members.map((member) => member.userId),
  ]);

  const invalidUsers = payload.entries.filter((entry) => !allowedUserIds.has(entry.userId));
  if (invalidUsers.length > 0) {
    return { error: "Ada user yang bukan anggota tim." };
  }

  const invalidDates = payload.entries.filter((entry) => !monthDaySet.has(entry.workDate));
  if (invalidDates.length > 0) {
    return { error: "Ada tanggal di luar periode bulan yang dipilih." };
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of payload.entries) {
      const workDate = new Date(`${entry.workDate}T00:00:00.000Z`);
      const uniqueWhere = {
        teamId_userId_workDate: {
          teamId: payload.teamId,
          userId: entry.userId,
          workDate,
        },
      };

      if (!entry.shiftCode) {
        await tx.teamScheduleAssignment.deleteMany({
          where: uniqueWhere.teamId_userId_workDate,
        });
        continue;
      }

      await tx.teamScheduleAssignment.upsert({
        where: uniqueWhere,
        create: {
          teamId: payload.teamId,
          userId: entry.userId,
          workDate,
          shiftCode: entry.shiftCode,
        },
        update: {
          shiftCode: entry.shiftCode,
        },
      });
    }
  });

  revalidatePath("/dashboard/management/kelola-jadwal");
  return { success: true };
}
