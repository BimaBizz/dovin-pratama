export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  SICK: "SICK",
  LEAVE: "LEAVE",
};

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: ATTENDANCE_STATUS.PRESENT, label: "Hadir" },
  { value: ATTENDANCE_STATUS.SICK, label: "Sakit" },
  { value: ATTENDANCE_STATUS.LEAVE, label: "Cuti" },
];

export function normalizeAttendanceStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === ATTENDANCE_STATUS.SICK) {
    return ATTENDANCE_STATUS.SICK;
  }

  if (normalized === ATTENDANCE_STATUS.LEAVE) {
    return ATTENDANCE_STATUS.LEAVE;
  }

  return ATTENDANCE_STATUS.PRESENT;
}

export function getAttendanceStatusLabel(status) {
  const normalized = normalizeAttendanceStatus(status);

  if (normalized === ATTENDANCE_STATUS.SICK) {
    return "Sakit";
  }

  if (normalized === ATTENDANCE_STATUS.LEAVE) {
    return "Cuti";
  }

  return "Hadir";
}