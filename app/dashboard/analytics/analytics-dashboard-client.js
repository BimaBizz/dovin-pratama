"use client";

import { Activity, Boxes, ChartColumnIncreasing, ShieldAlert, Users, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function toNumber(value) {
  return Number(value) || 0;
}

function formatMinutes(value) {
  return `${new Intl.NumberFormat("id-ID").format(toNumber(value))} menit`;
}

function formatCount(value) {
  return new Intl.NumberFormat("id-ID").format(toNumber(value));
}

function buildConicGradient(items) {
  const total = items.reduce((sum, item) => sum + toNumber(item.value), 0);

  if (total <= 0) {
    return "conic-gradient(#e4e4e7 0deg 360deg)";
  }

  let currentAngle = 0;
  const segments = items.map((item) => {
    const value = toNumber(item.value);
    const segmentAngle = (value / total) * 360;
    const start = currentAngle;
    const end = currentAngle + segmentAngle;
    currentAngle = end;
    return `${item.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function buildTrendPath(points, width, height, padding = 12) {
  if (!points.length) {
    return "";
  }

  const values = points.map((point) => toNumber(point.totalDuration));
  const maxValue = Math.max(1, ...values);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = padding + stepX * index;
      const y = height - padding - (toNumber(point.totalDuration) / maxValue) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildTrendAreaPath(points, width, height, padding = 12) {
  const linePath = buildTrendPath(points, width, height, padding);

  if (!linePath) {
    return "";
  }

  const startX = padding;
  const endX = points.length > 1 ? width - padding : padding;
  const baseY = height - padding;

  return `${linePath} L ${endX.toFixed(2)} ${baseY.toFixed(2)} L ${startX.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

function KpiCard({ icon: Icon, label, value, helper }) {
  return (
    <Card className="overflow-hidden border-zinc-200 bg-white">
      <CardContent className="p-0">
        <div className="h-1 w-full bg-linear-to-r from-zinc-700 to-zinc-300" />
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <Icon className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="text-2xl font-semibold text-zinc-900">{value}</p>
          <p className="text-xs text-zinc-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboardClient({ data }) {
  const usersByRole = Array.isArray(data?.usersByRole) ? data.usersByRole : [];
  const taskStatus = Array.isArray(data?.taskStatus) ? data.taskStatus : [];
  const attendanceStatus = Array.isArray(data?.attendanceStatus) ? data.attendanceStatus : [];
  const troubleMonthlyTrend = Array.isArray(data?.troubleMonthlyTrend) ? data.troubleMonthlyTrend : [];
  const topTroubleUnits = Array.isArray(data?.topTroubleUnits) ? data.topTroubleUnits : [];

  const maxRoleCount = Math.max(1, ...usersByRole.map((item) => toNumber(item.count)));
  const maxUnitDuration = Math.max(1, ...topTroubleUnits.map((item) => toNumber(item.duration)));
  const donutBackground = buildConicGradient(taskStatus);
  const trendWidth = 560;
  const trendHeight = 220;
  const trendPath = buildTrendPath(troubleMonthlyTrend, trendWidth, trendHeight);
  const trendAreaPath = buildTrendAreaPath(troubleMonthlyTrend, trendWidth, trendHeight);

  const totalTaskCount = taskStatus.reduce((sum, item) => sum + toNumber(item.value), 0);
  const totalAttendanceCount = attendanceStatus.reduce((sum, item) => sum + toNumber(item.value), 0);

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 bg-white">
        <CardHeader>
          <Badge className="w-fit">Analytics</Badge>
          <CardTitle className="text-2xl">Analisis Operasional</CardTitle>
          <CardDescription>
            Ringkasan tren user, tugas, absensi, trouble unit, dan sparepart dari data aktual sistem.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total User"
          value={formatCount(data?.kpi?.totalUsers)}
          helper="Akun aktif di sistem"
        />
        <KpiCard
          icon={Activity}
          label="Task Open"
          value={formatCount(data?.kpi?.totalOpenTasks)}
          helper="Task belum selesai"
        />
        <KpiCard
          icon={Wrench}
          label="Trouble Bulan Ini"
          value={formatMinutes(data?.kpi?.currentMonthTroubleDuration)}
          helper={`${formatCount(data?.kpi?.currentMonthTroubleCount)} kejadian`}
        />
        <KpiCard
          icon={ShieldAlert}
          label="Sparepart Low Stock"
          value={formatCount(data?.kpi?.lowStockSpareparts)}
          helper={`dari ${formatCount(data?.kpi?.totalSpareparts)} item sparepart`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Distribusi User per Role</CardTitle>
            <CardDescription>Komposisi user aktif berdasarkan role saat ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {usersByRole.length > 0 ? usersByRole.map((item) => {
              const widthPercent = (toNumber(item.count) / maxRoleCount) * 100;
              return (
                <div key={item.role} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-800">{item.role}</span>
                    <span className="text-zinc-500">{formatCount(item.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-linear-to-r from-sky-500 to-cyan-400"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-zinc-500">Belum ada data user.</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Status Task</CardTitle>
            <CardDescription>Perbandingan status task operasional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto h-44 w-44 rounded-full p-5" style={{ background: donutBackground }}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Total Task</p>
                  <p className="text-xl font-semibold text-zinc-900">{formatCount(totalTaskCount)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {taskStatus.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-zinc-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <span className="font-medium text-zinc-900">{formatCount(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Tren Durasi Trouble (6 Bulan)</CardTitle>
            <CardDescription>Total durasi trouble unit per bulan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {troubleMonthlyTrend.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <svg viewBox={`0 0 ${trendWidth} ${trendHeight}`} className="w-full" style={{ minWidth: "520px" }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    <path d={trendAreaPath} fill="url(#trendFill)" />
                    <path d={trendPath} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  {troubleMonthlyTrend.map((item) => (
                    <div key={item.key} className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                      <p className="font-medium text-zinc-700">{item.label}</p>
                      <p className="text-zinc-500">{formatCount(item.totalDuration)} mnt</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Belum ada data trouble bulanan.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Absensi Bulan Ini</CardTitle>
            <CardDescription>Distribusi status absensi bulan berjalan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {attendanceStatus.map((item) => {
              const percent = totalAttendanceCount > 0 ? (toNumber(item.value) / totalAttendanceCount) * 100 : 0;
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700">{item.label}</span>
                    <span className="font-medium text-zinc-900">{formatCount(item.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${percent}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Unit Trouble Bulan Ini</CardTitle>
          <CardDescription>Unit dengan total durasi trouble tertinggi pada bulan berjalan.</CardDescription>
        </CardHeader>
        <CardContent>
          {topTroubleUnits.length > 0 ? (
            <div className="space-y-3">
              {topTroubleUnits.map((item, index) => {
                const widthPercent = (toNumber(item.duration) / maxUnitDuration) * 100;
                return (
                  <div key={`${item.unitName}-${index}`} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 text-zinc-700">
                        <ChartColumnIncreasing className="h-4 w-4 text-zinc-500" />
                        {item.unitName}
                      </span>
                      <span className="font-medium text-zinc-900">{formatMinutes(item.duration)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-amber-500 to-orange-400"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Belum ada data trouble untuk bulan ini.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tim Aktif</CardTitle>
            <CardDescription>Total tim yang terdaftar di sistem.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Boxes className="h-4 w-4" />
            </div>
            <p className="text-lg font-semibold text-zinc-900">{formatCount(data?.kpi?.totalTeams)} tim</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kesehatan Sparepart</CardTitle>
            <CardDescription>Monitoring cepat stok sparepart operasional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
            <p>Total item: <span className="font-semibold text-zinc-900">{formatCount(data?.kpi?.totalSpareparts)}</span></p>
            <p>Low stock: <span className="font-semibold text-red-600">{formatCount(data?.kpi?.lowStockSpareparts)}</span></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}