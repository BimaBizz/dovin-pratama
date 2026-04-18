import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getCurrentSession } from "@/lib/auth";
import { ATTENDANCE_STATUS } from "@/lib/attendance-status";
import { getPermissionEvaluator } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const WEEKDAY_LABELS_ID = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];
const SHIFT_OFF_VALUE = "L";

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function getMonthLabel(month) {
  const [yearStr, monthStr] = month.split("-");
  const monthNames = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  const monthName = monthNames[Number(monthStr) - 1] || monthStr;
  return `${monthName} ${yearStr}`;
}

function getMonthRange(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  return { start, end };
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
    const dayNumber = index + 1;
    const dayDate = new Date(year, monthIndex, dayNumber);

    return {
      dayNumber,
      dayName: WEEKDAY_LABELS_ID[dayDate.getDay()],
      dateKey: `${yearStr}-${monthStr}-${String(dayNumber).padStart(2, "0")}`,
    };
  });
}

function toDateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getPositionLabel(role) {
  if (role === "LEADER TEKNISI") {
    return "Team Leader";
  }

  if (role === "ASS TEKNISI") {
    return "Assisten Teknisi";
  }

  if (role === "TEKNISI") {
    return "Teknisi";
  }

  return role || "-";
}

function resolveAttendanceMark({ shiftCode, attendanceRecord, dayDateKey, todayDateKey }) {
  if (!shiftCode) {
    return "";
  }

  if (shiftCode === SHIFT_OFF_VALUE) {
    return SHIFT_OFF_VALUE;
  }

  if (attendanceRecord) {
    if (attendanceRecord.status === ATTENDANCE_STATUS.SICK) {
      return "S";
    }

    if (attendanceRecord.status === ATTENDANCE_STATUS.LEAVE) {
      return "C";
    }

    return "✓";
  }

  if (dayDateKey <= todayDateKey) {
    return "✗";
  }

  return "";
}

async function ensureRecapPermission() {
  const session = await getCurrentSession();

  if (!session) {
    return { error: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const evaluator = await getPermissionEvaluator(session.user.role);
  if (!evaluator.canView("attendance-recap")) {
    return { error: new NextResponse("Forbidden", { status: 403 }) };
  }

  return { session, evaluator };
}

async function loadRecapExportData({ month, teamId, shiftFilter }) {
  const monthRange = getMonthRange(month);
  if (!monthRange) {
    return { error: "month tidak valid" };
  }

  const teams = await prisma.team.findMany({
    where: teamId ? { id: teamId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      leader: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      members: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (teams.length === 0) {
    return { error: "Tim tidak ditemukan" };
  }

  const schedules = await prisma.teamScheduleAssignment.findMany({
    where: {
      teamId: {
        in: teams.map((team) => team.id),
      },
      workDate: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
      ...(shiftFilter ? { shiftCode: shiftFilter } : {}),
    },
    orderBy: [
      { teamId: "asc" },
      { userId: "asc" },
      { workDate: "asc" },
    ],
    select: {
      id: true,
      teamId: true,
      userId: true,
      workDate: true,
      shiftCode: true,
      attendanceRecord: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const schedulesByTeam = schedules.reduce((accumulator, item) => {
    if (!accumulator.has(item.teamId)) {
      accumulator.set(item.teamId, []);
    }

    accumulator.get(item.teamId).push(item);
    return accumulator;
  }, new Map());

  const groups = teams.map((team) => {
    const participants = [team.leader, ...team.members.map((member) => member.user)].filter(Boolean);
    const scheduleMap = new Map(
      (schedulesByTeam.get(team.id) || []).map((item) => [
        `${item.userId}__${toDateString(item.workDate)}`,
        {
          shiftCode: item.shiftCode,
          attendanceRecord: item.attendanceRecord,
        },
      ])
    );

    return {
      teamName: team.name,
      participants,
      scheduleMap,
    };
  });

  return {
    groups,
    teamLabel: teamId ? teams[0]?.name || "-" : "SEMUA TIM",
  };
}

async function createTemplateExcelBuffer({ month, groups, teamLabel, shiftFilter }) {
  const monthDays = getMonthDays(month);
  const lastColumn = 3 + monthDays.length;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Jadwal Dinas");

  worksheet.addRow(["REKAPITULASI ABSENSI PT. DOVIN PRATAMA"]);
  worksheet.addRow(["PELAKSANAAN PEKERJAAN KONTRAK PAYUNG PEMELIHARAAN DAN PERAWATAN PASSENGER MOVEMENT SYSTEM"]);
  worksheet.addRow([`DI BANDAR UDARA INTERNASIONAL I GUSTI NGURAH RAI - BALI PERIODE ${getMonthLabel(month)}`]);
  worksheet.addRow([`TIM: ${String(teamLabel || "SEMUA TIM").toUpperCase()}${shiftFilter ? ` · SHIFT ${shiftFilter}` : ""}`]);
  worksheet.addRow(["NO", "NAMA", "JABATAN", ...monthDays.map((day) => String(day.dayNumber))]);
  worksheet.addRow(["", "", "", ...monthDays.map((day) => day.dayName)]);

  worksheet.mergeCells(1, 1, 1, lastColumn);
  worksheet.mergeCells(2, 1, 2, lastColumn);
  worksheet.mergeCells(3, 1, 3, lastColumn);
  worksheet.mergeCells(4, 1, 4, lastColumn);

  const headerAlignment = { horizontal: "center", vertical: "middle" };
  [1, 2, 3, 4, 5, 6].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      cell.alignment = headerAlignment;
      cell.font = { bold: true };
    }
  });

  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 32;
  worksheet.getColumn(3).width = 18;
  for (let column = 4; column <= lastColumn; column += 1) {
    worksheet.getColumn(column).width = 5;
  }

  const thinBorder = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  const todayDateKey = toDateString(new Date());

  let runningNumber = 1;
  for (const group of groups) {
    worksheet.addRow([`Team ${group.teamName.toUpperCase()}`]);

    group.participants.forEach((participant) => {
      const marks = monthDays.map((day) => {
        const item = group.scheduleMap.get(`${participant.id}__${day.dateKey}`);
        return resolveAttendanceMark({
          shiftCode: item?.shiftCode,
          attendanceRecord: item?.attendanceRecord,
          dayDateKey: day.dateKey,
          todayDateKey,
        });
      });

      worksheet.addRow([
        runningNumber,
        participant.fullName || participant.email || "-",
        getPositionLabel(participant.role),
        ...marks,
      ]);

      runningNumber += 1;
    });
  }

  for (let rowNumber = 7; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      cell.border = thinBorder;
      if (column === 1 || column >= 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createPdfBuffer({ month, groups, teamLabel, shiftFilter }) {
  const monthDays = getMonthDays(month);
  const pdfDoc = await PDFDocument.create();
  const pageSize = [1190.55, 841.89];
  let page = pdfDoc.addPage(pageSize);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginLeft = 24;
  const marginRight = 24;
  const marginTop = 24;
  const marginBottom = 20;
  const rowHeight = 16;
  const dayColumnWidth = 26;
  const baseColumns = [24, 150, 90];
  const columns = [...baseColumns, ...monthDays.map(() => dayColumnWidth)];
  const tableWidth = columns.reduce((sum, value) => sum + value, 0);
  const maxTableWidth = pageSize[0] - marginLeft - marginRight;
  const scale = tableWidth > maxTableWidth ? maxTableWidth / tableWidth : 1;
  const normalizedColumns = columns.map((value) => value * scale);

  const columnPositions = [];
  let cursorX = marginLeft;
  for (const width of normalizedColumns) {
    columnPositions.push(cursorX);
    cursorX += width;
  }

  const drawCellText = ({ currentPage, text, x, yTop, width, height, textFont, textSize, align = "center" }) => {
    const safeText = String(text ?? "");
    const textWidth = textFont.widthOfTextAtSize(safeText, textSize);
    const baseY = yTop - height + (height - textSize) / 2 + 2;
    let textX = x + 2;

    if (align === "center") {
      textX = x + (width - textWidth) / 2;
    }

    if (align === "right") {
      textX = x + width - textWidth - 2;
    }

    currentPage.drawText(safeText, {
      x: Math.max(textX, x + 1),
      y: baseY,
      size: textSize,
      font: textFont,
      color: rgb(0, 0, 0),
    });
  };

  const drawGridRow = (currentPage, yTop, values, options = {}) => {
    const { isBold = false, alignOverrides = {} } = options;

    for (let index = 0; index < normalizedColumns.length; index += 1) {
      const x = columnPositions[index];
      const width = normalizedColumns[index];

      currentPage.drawRectangle({
        x,
        y: yTop - rowHeight,
        width,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.6,
      });

      const align = alignOverrides[index] || (index === 1 || index === 2 ? "left" : "center");
      drawCellText({
        currentPage,
        text: values[index] ?? "",
        x,
        yTop,
        width,
        height: rowHeight,
        textFont: isBold ? boldFont : font,
        textSize: 8,
        align,
      });
    }

    return yTop - rowHeight;
  };

  const drawPageHeader = (currentPage) => {
    let y = pageSize[1] - marginTop;

    const titleLines = [
      "REKAPITULASI ABSENSI PT. DOVIN PRATAMA",
      "PELAKSANAAN PEKERJAAN KONTRAK PAYUNG PEMELIHARAAN DAN PERAWATAN PASSENGER MOVEMENT SYSTEM",
      `DI BANDAR UDARA INTERNASIONAL I GUSTI NGURAH RAI - BALI PERIODE ${getMonthLabel(month)}`,
+      `TIM ${String(teamLabel || "SEMUA TIM").toUpperCase()}${shiftFilter ? ` · SHIFT ${shiftFilter}` : ""}`,
    ];

    for (const line of titleLines) {
      const titleWidth = boldFont.widthOfTextAtSize(line, 12);
      currentPage.drawText(line, {
        x: marginLeft + (normalizedColumns.reduce((sum, w) => sum + w, 0) - titleWidth) / 2,
        y,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      y -= 18;
    }

    y -= 6;

    y = drawGridRow(currentPage, y, ["NO", "NAMA", "JABATAN", ...monthDays.map((day) => String(day.dayNumber))], {
      isBold: true,
      alignOverrides: { 1: "center", 2: "center" },
    });

    y = drawGridRow(currentPage, y, ["", "", "", ...monthDays.map((day) => day.dayName)], {
      isBold: true,
      alignOverrides: { 1: "center", 2: "center" },
    });

    return y;
  };

  let cursorY = drawPageHeader(page);
  let runningNumber = 1;
  const todayDateKey = toDateString(new Date());

  for (const group of groups) {
    if (cursorY - rowHeight < marginBottom) {
      page = pdfDoc.addPage(pageSize);
      cursorY = drawPageHeader(page);
    }

    cursorY = drawGridRow(page, cursorY, [`Team ${group.teamName.toUpperCase()}`], {
      isBold: true,
      alignOverrides: { 0: "left", 1: "left", 2: "left" },
    });

    for (const participant of group.participants) {
      if (cursorY - rowHeight < marginBottom) {
        page = pdfDoc.addPage(pageSize);
        cursorY = drawPageHeader(page);
      }

      const marks = monthDays.map((day) => {
        const item = group.scheduleMap.get(`${participant.id}__${day.dateKey}`);
        return resolveAttendanceMark({
          shiftCode: item?.shiftCode,
          attendanceRecord: item?.attendanceRecord,
          dayDateKey: day.dateKey,
          todayDateKey,
        });
      });

      cursorY = drawGridRow(page, cursorY, [
        runningNumber,
        participant.fullName || participant.email || "-",
        getPositionLabel(participant.role),
        ...marks,
      ]);

      runningNumber += 1;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

export async function GET(request) {
  const access = await ensureRecapPermission();
  if (access.error) {
    return access.error;
  }

  const { searchParams } = new URL(request.url);
  const date = String(searchParams.get("date") || "").trim();
  const teamId = String(searchParams.get("teamId") || "").trim();
  const shift = String(searchParams.get("shift") || "").trim();
  const format = String(searchParams.get("format") || "excel").trim().toLowerCase();

  if (!isValidDate(date)) {
    return new NextResponse("date tidak valid", { status: 400 });
  }

  if (shift && shift !== "P/S" && shift !== "M" && shift !== "L") {
    return new NextResponse("shift tidak valid", { status: 400 });
  }

  if (format !== "excel" && format !== "pdf") {
    return new NextResponse("format harus excel atau pdf", { status: 400 });
  }

  const month = date.slice(0, 7);
  const recapData = await loadRecapExportData({ month, teamId, shiftFilter: shift });

  if (recapData.error) {
    return new NextResponse(recapData.error, { status: recapData.error === "Tim tidak ditemukan" ? 404 : 400 });
  }

  const buffer = format === "excel"
    ? await createTemplateExcelBuffer({
        month,
        groups: recapData.groups,
        teamLabel: recapData.teamLabel,
        shiftFilter: shift,
      })
    : await createPdfBuffer({
        month,
        groups: recapData.groups,
        teamLabel: recapData.teamLabel,
        shiftFilter: shift,
      });

  const fileBaseName = `REKAP-ABSEN-${month}${teamId ? `-${recapData.teamLabel.replace(/\s+/g, "-").toUpperCase()}` : ""}${shift ? `-${shift.replace(/\//g, "-")}` : ""}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${fileBaseName}.${format === "excel" ? "xlsx" : "pdf"}"`,
      "Cache-Control": "no-store",
    },
  });
}
