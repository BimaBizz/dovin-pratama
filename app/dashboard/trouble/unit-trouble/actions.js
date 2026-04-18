"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getTroubleRecordDelegate() {
  return prisma.troubleRecord;
}

function getTroubleUnitDelegate() {
  return prisma.troubleUnit;
}

function parseDateInput(value) {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return undefined;
  }

  return new Date(`${text}T00:00:00.000Z`);
}

function parseTimeInput(value) {
  const text = String(value || "").trim();

  if (!/^\d{2}:\d{2}$/.test(text)) {
    return null;
  }

  const [hoursText, minutesText] = text.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes, text };
}

function calculateDurationMinutes(timeOff, timeOn) {
  const startMinutes = timeOff.hours * 60 + timeOff.minutes;
  const endMinutes = timeOn.hours * 60 + timeOn.minutes;

  if (endMinutes < startMinutes) {
    return null;
  }

  return endMinutes - startMinutes;
}

async function ensureUnitExists(unitId) {
  const unitDelegate = getTroubleUnitDelegate();

  if (!unitDelegate?.findUnique) {
    return { error: "Model TroubleUnit belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const unit = await unitDelegate.findUnique({
    where: { id: unitId },
    select: { id: true, name: true },
  });

  if (!unit) {
    return { error: "Nama unit tidak ditemukan." };
  }

  return { unit };
}

export async function createTroubleRecordAction(formData) {
  await requirePagePermission("trouble-unit", "create");

  const unitId = String(formData.get("unitId") || "").trim();
  const troubleDateRaw = String(formData.get("troubleDate") || "").trim();
  const timeOffRaw = String(formData.get("timeOff") || "").trim();
  const timeOnRaw = String(formData.get("timeOn") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!unitId) {
    return { error: "Nama unit wajib dipilih." };
  }

  const troubleDate = parseDateInput(troubleDateRaw);
  if (!troubleDate) {
    return { error: "Tanggal tidak valid." };
  }

  const timeOff = parseTimeInput(timeOffRaw);
  if (!timeOff) {
    return { error: "Waktu off tidak valid." };
  }

  const timeOn = parseTimeInput(timeOnRaw);
  if (!timeOn) {
    return { error: "Waktu on tidak valid." };
  }

  const durationMinutes = calculateDurationMinutes(timeOff, timeOn);
  if (durationMinutes === null) {
    return { error: "Waktu on harus lebih besar atau sama dengan waktu off." };
  }

  const unitCheck = await ensureUnitExists(unitId);
  if (unitCheck.error) {
    return { error: unitCheck.error };
  }

  const recordDelegate = getTroubleRecordDelegate();
  if (!recordDelegate?.create) {
    return { error: "Model TroubleRecord belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  await recordDelegate.create({
    data: {
      unitId,
      troubleDate,
      timeOff: timeOff.text,
      timeOn: timeOn.text,
      durationMinutes,
      note: note || null,
    },
  });

  revalidatePath("/dashboard/trouble/unit-trouble");
  return { success: true };
}

export async function updateTroubleRecordAction(formData) {
  await requirePagePermission("trouble-unit", "update");

  const id = String(formData.get("id") || "").trim();
  const unitId = String(formData.get("unitId") || "").trim();
  const troubleDateRaw = String(formData.get("troubleDate") || "").trim();
  const timeOffRaw = String(formData.get("timeOff") || "").trim();
  const timeOnRaw = String(formData.get("timeOn") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!id) {
    return { error: "ID trouble tidak valid." };
  }

  if (!unitId) {
    return { error: "Nama unit wajib dipilih." };
  }

  const troubleDate = parseDateInput(troubleDateRaw);
  if (!troubleDate) {
    return { error: "Tanggal tidak valid." };
  }

  const timeOff = parseTimeInput(timeOffRaw);
  if (!timeOff) {
    return { error: "Waktu off tidak valid." };
  }

  const timeOn = parseTimeInput(timeOnRaw);
  if (!timeOn) {
    return { error: "Waktu on tidak valid." };
  }

  const durationMinutes = calculateDurationMinutes(timeOff, timeOn);
  if (durationMinutes === null) {
    return { error: "Waktu on harus lebih besar atau sama dengan waktu off." };
  }

  const unitCheck = await ensureUnitExists(unitId);
  if (unitCheck.error) {
    return { error: unitCheck.error };
  }

  const recordDelegate = getTroubleRecordDelegate();
  if (!recordDelegate?.findUnique || !recordDelegate?.update) {
    return { error: "Model TroubleRecord belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const existingRecord = await recordDelegate.findUnique({ where: { id } });
  if (!existingRecord) {
    return { error: "Data trouble tidak ditemukan." };
  }

  await recordDelegate.update({
    where: { id },
    data: {
      unitId,
      troubleDate,
      timeOff: timeOff.text,
      timeOn: timeOn.text,
      durationMinutes,
      note: note || null,
    },
  });

  revalidatePath("/dashboard/trouble/unit-trouble");
  return { success: true };
}

export async function deleteTroubleRecordAction(formData) {
  await requirePagePermission("trouble-unit", "delete");

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return { error: "ID trouble tidak valid." };
  }

  const recordDelegate = getTroubleRecordDelegate();
  if (!recordDelegate?.findUnique || !recordDelegate?.delete) {
    return { error: "Model TroubleRecord belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" };
  }

  const existingRecord = await recordDelegate.findUnique({ where: { id } });
  if (!existingRecord) {
    return { error: "Data trouble tidak ditemukan." };
  }

  await recordDelegate.delete({ where: { id } });

  revalidatePath("/dashboard/trouble/unit-trouble");
  return { success: true };
}