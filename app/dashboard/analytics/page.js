import AnalyticsDashboardClient from "@/app/dashboard/analytics/analytics-dashboard-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Analytics",
  description: "Analisis operasional berbasis data dashboard",
};

function getMonthRange(monthShift = 0) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth() + monthShift;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  return { start, end };
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthlyBuckets(totalMonths = 6) {
  const buckets = [];

  for (let i = totalMonths - 1; i >= 0; i -= 1) {
    const { start } = getMonthRange(-i);

    buckets.push({
      key: monthKey(start),
      label: monthLabel(start),
      totalDuration: 0,
      totalRecords: 0,
    });
  }

  return buckets;
}

export default async function AnalyticsPage() {
  await requirePagePermission("analytics", "view");

  const currentMonthRange = getMonthRange(0);
  const monthlyBuckets = buildMonthlyBuckets(6);
  const monthlyBucketMap = new Map(monthlyBuckets.map((item) => [item.key, item]));

  const [
    totalUsers,
    totalTeams,
    totalSpareparts,
    lowStockSpareparts,
    users,
    taskStatusRows,
    attendanceStatusRows,
    troubleRows,
  ] = await Promise.all([
    prisma.user?.count ? prisma.user.count() : 0,
    prisma.team?.count ? prisma.team.count() : 0,
    prisma.sparepart?.count ? prisma.sparepart.count() : 0,
    prisma.sparepart?.count
      ? prisma.sparepart.count({
          where: {
            quantity: {
              lte: 5,
            },
          },
        })
      : 0,
    prisma.user?.findMany
      ? prisma.user.findMany({
          select: {
            role: true,
          },
        })
      : [],
    prisma.task?.groupBy
      ? prisma.task.groupBy({
          by: ["status"],
          _count: {
            status: true,
          },
        })
      : [],
    prisma.attendanceRecord?.groupBy
      ? prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: {
            attendedAt: {
              gte: currentMonthRange.start,
              lt: currentMonthRange.end,
            },
          },
          _count: {
            status: true,
          },
        })
      : [],
    prisma.troubleRecord?.findMany
      ? prisma.troubleRecord.findMany({
          where: {
            troubleDate: {
              gte: monthlyBuckets[0] ? new Date(`${monthlyBuckets[0].key}-01T00:00:00.000Z`) : currentMonthRange.start,
              lt: currentMonthRange.end,
            },
          },
          select: {
            troubleDate: true,
            durationMinutes: true,
            unit: {
              select: {
                name: true,
              },
            },
          },
        })
      : [],
  ]);

  const usersByRoleMap = users.reduce((accumulator, user) => {
    const role = String(user.role || "UNKNOWN").trim() || "UNKNOWN";
    accumulator.set(role, (accumulator.get(role) || 0) + 1);
    return accumulator;
  }, new Map());

  const usersByRole = Array.from(usersByRoleMap.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  const taskStatusMap = new Map(taskStatusRows.map((row) => [row.status, row._count.status]));
  const taskStatus = [
    { key: "TODO", label: "To Do", value: taskStatusMap.get("TODO") || 0, color: "#3b82f6" },
    { key: "IN_PROGRESS", label: "In Progress", value: taskStatusMap.get("IN_PROGRESS") || 0, color: "#f59e0b" },
    { key: "DONE", label: "Done", value: taskStatusMap.get("DONE") || 0, color: "#10b981" },
  ];

  const attendanceStatusMap = new Map(attendanceStatusRows.map((row) => [row.status, row._count.status]));
  const attendanceStatus = [
    { key: "PRESENT", label: "Hadir", value: attendanceStatusMap.get("PRESENT") || 0, color: "#16a34a" },
    { key: "SICK", label: "Sakit", value: attendanceStatusMap.get("SICK") || 0, color: "#f59e0b" },
    { key: "LEAVE", label: "Cuti", value: attendanceStatusMap.get("LEAVE") || 0, color: "#6366f1" },
  ];

  const troubleByUnitMap = new Map();
  let currentMonthTroubleDuration = 0;
  let currentMonthTroubleCount = 0;

  troubleRows.forEach((row) => {
    const duration = Number(row.durationMinutes) || 0;
    const unitName = String(row.unit?.name || "-").trim() || "-";
    const bucketKey = monthKey(new Date(row.troubleDate));

    if (monthlyBucketMap.has(bucketKey)) {
      const bucket = monthlyBucketMap.get(bucketKey);
      bucket.totalDuration += duration;
      bucket.totalRecords += 1;
    }

    if (new Date(row.troubleDate) >= currentMonthRange.start && new Date(row.troubleDate) < currentMonthRange.end) {
      currentMonthTroubleDuration += duration;
      currentMonthTroubleCount += 1;
      troubleByUnitMap.set(unitName, (troubleByUnitMap.get(unitName) || 0) + duration);
    }
  });

  const topTroubleUnits = Array.from(troubleByUnitMap.entries())
    .map(([unitName, duration]) => ({ unitName, duration }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 6);

  const analyticsData = {
    kpi: {
      totalUsers,
      totalTeams,
      totalSpareparts,
      lowStockSpareparts,
      currentMonthTroubleDuration,
      currentMonthTroubleCount,
      totalOpenTasks: taskStatus
        .filter((item) => item.key !== "DONE")
        .reduce((sum, item) => sum + item.value, 0),
    },
    usersByRole,
    taskStatus,
    attendanceStatus,
    troubleMonthlyTrend: monthlyBuckets,
    topTroubleUnits,
  };

  return <AnalyticsDashboardClient data={analyticsData} />;
}