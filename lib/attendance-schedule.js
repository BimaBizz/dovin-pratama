import { prisma } from "@/lib/prisma";
import { getAttendanceSetting } from "@/lib/attendance-settings";

function normalizeDateOnly(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function toMinutes(timeText) {
  const [hours, minutes] = String(timeText || "").split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(date);
}

function formatTimeLabel(date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function toIsoString(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function getAllowedWindowForShift(shiftSetting, now = new Date()) {
  const [startHour, startMinute] = shiftSetting.startTime.split(":").map(Number);
  const [endHour, endMinute] = shiftSetting.endTime.split(":").map(Number);

  const start = new Date(now);
  start.setHours(startHour, startMinute, 0, 0);
  start.setMinutes(start.getMinutes() - Number(shiftSetting.beforeMinutes || 0));

  const end = new Date(now);
  end.setHours(endHour, endMinute, 59, 999);
  end.setMinutes(end.getMinutes() + Number(shiftSetting.afterMinutes || 0));

  return { start, end };
}

function buildAttendanceContextMessage({ shiftCode, shiftSetting, window, now }) {
  const windowStart = formatTimeLabel(window.start);
  const windowEnd = formatTimeLabel(window.end);
  const nowLabel = formatTimeLabel(now);

  return `Absensi untuk shift ${shiftCode} hanya bisa dilakukan pada ${windowStart} - ${windowEnd}. Saat ini ${nowLabel}.`;
}

export async function getTodaysScheduledAttendanceForUser(userId, now = new Date()) {
  const attendanceSetting = await getAttendanceSetting();
  const today = normalizeDateOnly(now);

  if (!today) {
    return { error: "Tanggal server tidak valid." };
  }

  const team = await prisma.team.findFirst({
    where: {
      OR: [
        { leaderId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!team) {
    return { error: "User belum terhubung ke tim mana pun." };
  }

  const assignment = await prisma.teamScheduleAssignment.findFirst({
    where: {
      teamId: team.id,
      userId,
      workDate: new Date(`${today}T00:00:00.000Z`),
    },
    select: {
      id: true,
      shiftCode: true,
      workDate: true,
      team: {
        select: { id: true, name: true },
      },
    },
  });

  if (!assignment) {
    return { error: "Jadwal absensi hari ini belum tersedia untuk user ini." };
  }

  const existingAttendance = await prisma.attendanceRecord.findUnique({
    where: { scheduleAssignmentId: assignment.id },
    select: {
      id: true,
      attendedAt: true,
    },
  });

  const shiftSetting = attendanceSetting.shifts?.[assignment.shiftCode];
  if (!shiftSetting) {
    return { error: `Setting shift ${assignment.shiftCode} belum tersedia.` };
  }

  const window = getAllowedWindowForShift(shiftSetting, now);
  const isBeforeWindow = now < window.start;
  const isAfterWindow = now > window.end;

  return {
    team,
    assignment,
    shiftSetting,
    window,
    allowed: !isBeforeWindow && !isAfterWindow,
    alreadyAttended: Boolean(existingAttendance),
    existingAttendance,
    isBeforeWindow,
    isAfterWindow,
    message: buildAttendanceContextMessage({
      shiftCode: assignment.shiftCode,
      shiftSetting,
      window,
      now,
    }),
    nowLabel: formatTimeLabel(now),
    dateLabel: formatDateLabel(now),
    windowStartIso: toIsoString(window.start),
    windowEndIso: toIsoString(window.end),
    nowIso: toIsoString(now),
  };
}
