import ScheduleManagementClient from "@/app/dashboard/management/kelola-jadwal/schedule-management-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Kelola Jadwal",
  description: "Pengelolaan jadwal shift per tim",
};

function getDefaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function toDateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeMember(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

export default async function KelolaJadwalPage({ searchParams }) {
  const { evaluator } = await requirePagePermission("management-schedules", "view");

  const teamDelegate = prisma.team;
  const assignmentDelegate = prisma.teamScheduleAssignment;

  const resolvedSearchParams = await searchParams;
  const month = String(resolvedSearchParams?.month || getDefaultMonth()).trim();
  const teamId = String(resolvedSearchParams?.teamId || "").trim();

  if (!teamDelegate?.findMany || !assignmentDelegate?.findMany) {
    return (
      <ScheduleManagementClient
        teams={[]}
        selectedTeamId=""
        selectedMonth={month}
        participants={[]}
        assignments={[]}
        recentAssignments={[]}
        initError="Model jadwal belum siap di Prisma Client. Jalankan: npm run prisma:generate && npm run prisma:push"
      />
    );
  }

  const teams = await teamDelegate.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const selectedTeamId = teamId || teams[0]?.id || "";
  const monthRange = getMonthRange(month);

  const selectedTeam = selectedTeamId
    ? await teamDelegate.findUnique({
        where: { id: selectedTeamId },
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
      })
    : null;

  const participants = selectedTeam
    ? [
        normalizeMember(selectedTeam.leader),
        ...selectedTeam.members.map((member) => normalizeMember(member.user)),
      ].filter(Boolean)
    : [];

  const assignments = selectedTeamId && monthRange
    ? await assignmentDelegate.findMany({
        where: {
          teamId: selectedTeamId,
          workDate: {
            gte: monthRange.start,
            lt: monthRange.end,
          },
        },
        orderBy: [
          { userId: "asc" },
          { workDate: "asc" },
        ],
        select: {
          userId: true,
          workDate: true,
          shiftCode: true,
        },
      })
    : [];

  const recentAssignmentsRaw = await assignmentDelegate.findMany({
    orderBy: [
      { workDate: "desc" },
      { updatedAt: "desc" },
    ],
    take: 30,
    select: {
      id: true,
      workDate: true,
      shiftCode: true,
      teamId: true,
      userId: true,
    },
  });

  const userIds = Array.from(new Set([...participants.map((user) => user.id), ...recentAssignmentsRaw.map((item) => item.userId)]));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      })
    : [];

  const userMap = new Map(users.map((user) => [user.id, user]));
  const teamNameMap = new Map(teams.map((team) => [team.id, team.name]));

  const normalizedAssignments = assignments.map((item) => ({
    userId: item.userId,
    workDate: toDateString(item.workDate),
    shiftCode: item.shiftCode,
  }));

  const recentAssignments = recentAssignmentsRaw.map((item) => ({
    id: item.id,
    workDate: toDateString(item.workDate),
    shiftCode: item.shiftCode,
    teamName: teamNameMap.get(item.teamId) || "-",
    userName: userMap.get(item.userId)?.fullName || userMap.get(item.userId)?.email || "-",
  }));

  return (
    <ScheduleManagementClient
      teams={teams}
      selectedTeamId={selectedTeamId}
      selectedMonth={month}
      participants={participants}
      assignments={normalizedAssignments}
      recentAssignments={recentAssignments}
      canUpdate={evaluator.canCrud("management-schedules", "update")}
    />
  );
}
