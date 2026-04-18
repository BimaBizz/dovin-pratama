import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getCurrentSession } from "@/lib/auth";
import { getPermissionEvaluator } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
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

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function buildWhere(search, month) {
  const monthRange = getMonthRange(month);
  const searchFilter = search
    ? {
        OR: [
          { note: { contains: search } },
          { unit: { is: { name: { contains: search } } } },
        ],
      }
    : null;

  if (!monthRange) {
    return searchFilter || {};
  }

  const filters = [
    {
      troubleDate: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
    },
  ];

  if (searchFilter) {
    filters.push(searchFilter);
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

async function ensurePermission() {
  const session = await getCurrentSession();

  if (!session) {
    return { error: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const evaluator = await getPermissionEvaluator(session.user.role);
  if (!evaluator.canView("trouble-unit")) {
    return { error: new NextResponse("Forbidden", { status: 403 }) };
  }

  return { session, evaluator };
}

function toDateLabel(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function toDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getMonthDays(month) {
  const monthRange = getMonthRange(month);

  if (!monthRange) {
    return [];
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    return {
      dayNumber,
      dateKey: `${yearStr}-${monthStr}-${String(dayNumber).padStart(2, "0")}`,
    };
  });
}

async function createExcelBuffer({ month, search, records }) {
  const monthDays = getMonthDays(month);

  const summaryByUnit = records.reduce((accumulator, record) => {
    const unitName = String(record.unit?.name || "-").trim() || "-";
    const dayKey = toDateKey(record.troubleDate);
    const durationMinutes = Number(record.durationMinutes) || 0;

    if (!accumulator.has(unitName)) {
      accumulator.set(unitName, {
        unitName,
        totalDurationMinutes: 0,
        totalRecords: 0,
        durationByDay: new Map(),
      });
    }

    const item = accumulator.get(unitName);
    item.totalDurationMinutes += durationMinutes;
    item.totalRecords += 1;
    item.durationByDay.set(dayKey, (item.durationByDay.get(dayKey) || 0) + durationMinutes);

    return accumulator;
  }, new Map());

  const summaryRows = Array.from(summaryByUnit.values()).sort((a, b) => a.unitName.localeCompare(b.unitName));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data Trouble");
  const summaryWorksheet = workbook.addWorksheet("Laporan Bulanan");

  worksheet.addRow(["LAPORAN UNIT TROUBLE PT. DOVIN PRATAMA"]);
  worksheet.addRow([`PERIODE ${getMonthLabel(month)}`]);
  worksheet.addRow([search ? `PENCARIAN: ${search}` : "SEMUA DATA"]);
  worksheet.addRow([]);
  worksheet.addRow(["NO", "NAMA UNIT", "TANGGAL", "WAKTU OFF", "WAKTU ON", "DURASI (MENIT)", "KETERANGAN"]);

  worksheet.mergeCells(1, 1, 1, 7);
  worksheet.mergeCells(2, 1, 2, 7);
  worksheet.mergeCells(3, 1, 3, 7);

  [1, 2, 3, 5].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    for (let column = 1; column <= 7; column += 1) {
      const cell = row.getCell(column);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold: true };
    }
  });

  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 24;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 14;
  worksheet.getColumn(5).width = 14;
  worksheet.getColumn(6).width = 16;
  worksheet.getColumn(7).width = 40;

  records.forEach((record, index) => {
    worksheet.addRow([
      index + 1,
      record.unit?.name || "-",
      toDateLabel(record.troubleDate),
      record.timeOff,
      record.timeOn,
      record.durationMinutes,
      record.note || "-",
    ]);
  });

  const thinBorder = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    for (let column = 1; column <= 7; column += 1) {
      const cell = row.getCell(column);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: column === 7 ? "left" : "center" };
    }
  }

  const lastColumn = 2 + monthDays.length + 1;
  summaryWorksheet.addRow(["UNIT TROBLE PMS BANDARA IGUSTI NGURAHRAI INTERNASIONAL DAN DOMSESTIK"]);
  summaryWorksheet.addRow(["LAPORAN BULANAN"]);
  summaryWorksheet.addRow([search ? `PENCARIAN: ${search}` : ""]);
  summaryWorksheet.addRow(["No", "Nama Unit", ...monthDays.map((day) => day.dayNumber), "TOTAL DURASI OFF"]);

  summaryWorksheet.mergeCells(1, 1, 1, lastColumn);
  summaryWorksheet.mergeCells(2, 1, 2, lastColumn);
  summaryWorksheet.mergeCells(3, 1, 3, lastColumn);

  [1, 2, 3, 4].forEach((rowNumber) => {
    const row = summaryWorksheet.getRow(rowNumber);
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold: true };
    }
  });

  summaryWorksheet.getColumn(1).width = 5.83;
  summaryWorksheet.getColumn(2).width = 30.83;

  for (let column = 3; column < lastColumn; column += 1) {
    summaryWorksheet.getColumn(column).width = 5.83;
  }

  summaryWorksheet.getColumn(lastColumn).width = 20.83;

  summaryRows.forEach((item, index) => {
    const durationColumns = monthDays.map((day) => {
      const value = item.durationByDay.get(day.dateKey);
      return value && value > 0 ? value : "";
    });

    summaryWorksheet.addRow([index + 1, item.unitName, ...durationColumns, item.totalDurationMinutes]);
  });

  const summaryTotalDuration = summaryRows.reduce((sum, item) => sum + item.totalDurationMinutes, 0);
  const totalByDay = monthDays.map((day) => {
    return summaryRows.reduce((sum, item) => sum + (item.durationByDay.get(day.dateKey) || 0), 0);
  });

  summaryWorksheet.addRow([]);
  summaryWorksheet.addRow(["TOTAL", "", ...totalByDay, summaryTotalDuration]);

  for (let rowNumber = 4; rowNumber <= summaryWorksheet.rowCount; rowNumber += 1) {
    const row = summaryWorksheet.getRow(rowNumber);

    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: column === 2 ? "left" : "center" };
    }
  }

  const totalRow = summaryWorksheet.getRow(summaryWorksheet.rowCount);
  totalRow.font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createPdfBuffer({ month, search, records }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [842, 595];
  const margin = 24;
  const rowHeight = 18;
  const columns = [24, 120, 90, 80, 80, 70, 180];
  const positions = [];

  let cursorX = margin;
  for (const width of columns) {
    positions.push(cursorX);
    cursorX += width;
  }

  const drawRow = (page, yTop, values, isBold = false) => {
    for (let index = 0; index < columns.length; index += 1) {
      const x = positions[index];
      const width = columns[index];
      page.drawRectangle({
        x,
        y: yTop - rowHeight,
        width,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.6,
      });

      const text = String(values[index] ?? "");
      const fontToUse = isBold ? boldFont : font;
      const textWidth = fontToUse.widthOfTextAtSize(text, 8);
      const alignLeft = index === 6;
      const textX = alignLeft ? x + 2 : x + (width - textWidth) / 2;
      page.drawText(text, {
        x: Math.max(textX, x + 1),
        y: yTop - rowHeight + 4,
        size: 8,
        font: fontToUse,
        color: rgb(0, 0, 0),
      });
    }

    return yTop - rowHeight;
  };

  const drawHeader = (page) => {
    let y = pageSize[1] - margin;
    const titleLines = [
      "LAPORAN UNIT TROUBLE PT. DOVIN PRATAMA",
      `PERIODE ${getMonthLabel(month)}`,
      search ? `PENCARIAN: ${search}` : "SEMUA DATA",
    ];

    for (const line of titleLines) {
      const width = boldFont.widthOfTextAtSize(line, 12);
      page.drawText(line, {
        x: margin + (columns.reduce((sum, value) => sum + value, 0) - width) / 2,
        y,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      y -= 18;
    }

    y -= 4;
    return drawRow(page, y, ["NO", "NAMA UNIT", "TANGGAL", "WAKTU OFF", "WAKTU ON", "DURASI", "KETERANGAN"], true);
  };

  let page = pdfDoc.addPage(pageSize);
  let cursorY = drawHeader(page);

  records.forEach((record, index) => {
    if (cursorY - rowHeight < 40) {
      page = pdfDoc.addPage(pageSize);
      cursorY = drawHeader(page);
    }

    cursorY = drawRow(page, cursorY, [
      index + 1,
      record.unit?.name || "-",
      toDateLabel(record.troubleDate),
      record.timeOff,
      record.timeOn,
      record.durationMinutes,
      record.note || "-",
    ]);
  });

  return Buffer.from(await pdfDoc.save());
}

export async function GET(request) {
  const access = await ensurePermission();
  if (access.error) {
    return access.error;
  }

  const { searchParams } = new URL(request.url);
  const month = String(searchParams.get("month") || getCurrentMonthKey()).trim();
  const search = String(searchParams.get("search") || "").trim();
  const format = String(searchParams.get("format") || "excel").trim().toLowerCase();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return new NextResponse("month tidak valid", { status: 400 });
  }

  if (format !== "excel" && format !== "pdf") {
    return new NextResponse("format harus excel atau pdf", { status: 400 });
  }

  const records = await prisma.troubleRecord.findMany({
    where: buildWhere(search, month),
    orderBy: [{ troubleDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      troubleDate: true,
      timeOff: true,
      timeOn: true,
      durationMinutes: true,
      note: true,
      unit: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const buffer = format === "excel"
    ? await createExcelBuffer({ month, search, records })
    : await createPdfBuffer({ month, search, records });

  const fileBaseName = `TROUBLE-${month}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${fileBaseName}.${format === "excel" ? "xlsx" : "pdf"}"`,
      "Cache-Control": "no-store",
    },
  });
}