import { prisma } from "@/lib/prisma";

const DEFAULT_SINGLETON_KEY = "GLOBAL";

const DEFAULT_ATTENDANCE_SETTING = {
  shifts: {
    "P/S": {
      label: "P/S",
      startTime: "07:00",
      endTime: "09:00",
      beforeMinutes: 30,
      afterMinutes: 30,
    },
    M: {
      label: "M",
      startTime: "13:00",
      endTime: "15:00",
      beforeMinutes: 30,
      afterMinutes: 30,
    },
    L: {
      label: "L",
      startTime: "19:00",
      endTime: "21:00",
      beforeMinutes: 30,
      afterMinutes: 30,
    },
  },
};

function cloneValue(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeMinutes(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function normalizeTime(value) {
  const text = String(value || "").trim();

  if (!/^\d{2}:\d{2}$/.test(text)) {
    return null;
  }

  const [hours, minutes] = text.split(":").map(Number);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return text;
}

export function getDefaultAttendanceSetting() {
  return cloneValue(DEFAULT_ATTENDANCE_SETTING);
}

export function validateAttendanceSetting(config) {
  if (!config || typeof config !== "object") {
    return { error: "Setting absensi harus berupa object JSON." };
  }

  if (!config.shifts || typeof config.shifts !== "object") {
    return { error: "Setting absensi harus memiliki shifts object." };
  }

  for (const shiftCode of ["P/S", "M", "L"]) {
    const shift = config.shifts[shiftCode];

    if (!shift || typeof shift !== "object") {
      return { error: `Setting shift ${shiftCode} wajib diisi.` };
    }

    if (!normalizeTime(shift.startTime)) {
      return { error: `startTime shift ${shiftCode} tidak valid.` };
    }

    if (!normalizeTime(shift.endTime)) {
      return { error: `endTime shift ${shiftCode} tidak valid.` };
    }

    if (normalizeMinutes(shift.beforeMinutes) === null) {
      return { error: `beforeMinutes shift ${shiftCode} harus angka >= 0.` };
    }

    if (normalizeMinutes(shift.afterMinutes) === null) {
      return { error: `afterMinutes shift ${shiftCode} harus angka >= 0.` };
    }
  }

  return { success: true };
}

export function normalizeAttendanceSetting(config) {
  const base = getDefaultAttendanceSetting();
  const shifts = {};

  for (const shiftCode of ["P/S", "M", "L"]) {
    const source = config?.shifts?.[shiftCode] || {};

    shifts[shiftCode] = {
      label: String(source.label || shiftCode).trim() || shiftCode,
      startTime: normalizeTime(source.startTime) || base.shifts[shiftCode].startTime,
      endTime: normalizeTime(source.endTime) || base.shifts[shiftCode].endTime,
      beforeMinutes: normalizeMinutes(source.beforeMinutes) ?? base.shifts[shiftCode].beforeMinutes,
      afterMinutes: normalizeMinutes(source.afterMinutes) ?? base.shifts[shiftCode].afterMinutes,
    };
  }

  return { shifts };
}

export async function getAttendanceSetting() {
  const delegate = prisma.attendanceSetting;

  if (!delegate?.findUnique) {
    return getDefaultAttendanceSetting();
  }

  try {
    const row = await delegate.findUnique({
      where: { singletonKey: DEFAULT_SINGLETON_KEY },
      select: { config: true },
    });

    if (!row?.config || typeof row.config !== "object") {
      return getDefaultAttendanceSetting();
    }

    const normalized = normalizeAttendanceSetting(row.config);
    const validation = validateAttendanceSetting(normalized);

    if (validation.error) {
      return getDefaultAttendanceSetting();
    }

    return normalized;
  } catch {
    return getDefaultAttendanceSetting();
  }
}

export async function saveAttendanceSetting({ config, updatedByUserId = null }) {
  const validation = validateAttendanceSetting(config);
  if (validation.error) {
    return { error: validation.error };
  }

  const delegate = prisma.attendanceSetting;
  if (!delegate?.upsert) {
    return {
      error: "Model AttendanceSetting belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  const normalized = normalizeAttendanceSetting(config);

  try {
    await delegate.upsert({
      where: { singletonKey: DEFAULT_SINGLETON_KEY },
      update: {
        config: normalized,
        updatedByUserId,
      },
      create: {
        singletonKey: DEFAULT_SINGLETON_KEY,
        config: normalized,
        updatedByUserId,
      },
    });

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal menyimpan setting absensi." };
  }
}
