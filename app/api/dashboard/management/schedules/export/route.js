import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHIFT_VALUES } from "@/app/dashboard/management/kelola-tim/constants";

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

function toDateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function createExcelBuffer(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Jadwal");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

async function createPdfBuffer({ title, rows }) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([842, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawHeader = (currentPage, cursorY) => {
    currentPage.drawText(title, {
      x: 24,
      y: cursorY,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    cursorY -= 22;

    currentPage.drawText("Tanggal", { x: 24, y: cursorY, size: 10, font: boldFont });
    currentPage.drawText("Tim", { x: 130, y: cursorY, size: 10, font: boldFont });
    currentPage.drawText("Anggota", { x: 260, y: cursorY, size: 10, font: boldFont });
    currentPage.drawText("Shift", { x: 500, y: cursorY, size: 10, font: boldFont });

    return cursorY - 14;
  };

  let cursorY = drawHeader(page, 560);

  for (const row of rows) {
    if (cursorY < 24) {
      page = pdfDoc.addPage([842, 595]);
      cursorY = drawHeader(page, 560);
    }

    page.drawText(String(row.Tanggal), { x: 24, y: cursorY, size: 10, font });
    page.drawText(String(row.Tim), { x: 130, y: cursorY, size: 10, font });
    page.drawText(String(row.Anggota), { x: 260, y: cursorY, size: 10, font });
    page.drawText(String(row.Shift), { x: 500, y: cursorY, size: 10, font });

    cursorY -= 14;
  }

  return Buffer.from(await pdfDoc.save());
}

function ensureScheduleDelegate() {
  const scheduleDelegate = prisma.teamScheduleAssignment;

  if (!scheduleDelegate?.findMany) {
    return {
      error: "Model teamScheduleAssignment belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  return { scheduleDelegate };
}

export async function GET(request) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "SUPERUSER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = String(searchParams.get("teamId") || "").trim();
  const month = String(searchParams.get("month") || "").trim();
  const format = String(searchParams.get("format") || "excel").trim().toLowerCase();

  if (!teamId) {
    return new NextResponse("teamId wajib diisi", { status: 400 });
  }

  const monthRange = getMonthRange(month);
  if (!monthRange) {
    return new NextResponse("month tidak valid", { status: 400 });
  }

  if (format !== "excel" && format !== "pdf") {
    return new NextResponse("format harus excel atau pdf", { status: 400 });
  }

  const delegate = ensureScheduleDelegate();
  if (delegate.error) {
    return new NextResponse(delegate.error, { status: 500 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      leader: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      members: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    return new NextResponse("Tim tidak ditemukan", { status: 404 });
  }

  const participants = [team.leader, ...team.members.map((member) => member.user)].filter(Boolean);
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));

  const schedules = await delegate.scheduleDelegate.findMany({
    where: {
      teamId,
      workDate: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
    },
    orderBy: [
      { workDate: "asc" },
      { userId: "asc" },
    ],
    select: {
      workDate: true,
      shiftCode: true,
      userId: true,
    },
  });

  const rows = schedules.map((item) => ({
    Tanggal: toDateString(item.workDate),
    Tim: team.name,
    Anggota: participantMap.get(item.userId)?.fullName || participantMap.get(item.userId)?.email || "-",
    Shift: SHIFT_VALUES.includes(item.shiftCode) ? item.shiftCode : "-",
  }));

  if (format === "excel") {
    const buffer = await createExcelBuffer(rows);
    const fileName = `jadwal-${team.name.replace(/\s+/g, "-").toLowerCase()}-${month}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdfBuffer = await createPdfBuffer({
    title: `Jadwal Tim ${team.name} - ${month}`,
    rows,
  });

  const pdfFileName = `jadwal-${team.name.replace(/\s+/g, "-").toLowerCase()}-${month}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
