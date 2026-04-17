import TeamManagementClient from "@/app/dashboard/management/kelola-tim/team-management-client";
import { requireSuperuser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { TEAM_LEADER_ROLE } from "./constants";

export const metadata = {
  title: "Kelola Tim",
  description: "Pengelolaan data tim dan leader tim",
};

const PAGE_SIZE = 10;

async function buildSearchFilter(search) {
  if (!search) {
    return {};
  }

  const matchedUsers = await prisma.user.findMany({
    where: {
      OR: [{ fullName: { contains: search } }, { email: { contains: search } }],
    },
    select: { id: true },
  });

  const matchedUserIds = matchedUsers.map((user) => user.id);

  let memberTeamIds = [];
  if (matchedUserIds.length > 0 && prisma.teamMember?.findMany) {
    const matchedTeamMembers = await prisma.teamMember.findMany({
      where: {
        userId: { in: matchedUserIds },
      },
      select: { teamId: true },
    });

    memberTeamIds = Array.from(new Set(matchedTeamMembers.map((member) => member.teamId)));
  }

  return {
    OR: [
      { name: { contains: search } },
      { leaderId: { in: matchedUserIds } },
      { id: { in: memberTeamIds } },
    ],
  };
}

export default async function KelolaTimPage({ searchParams }) {
  await requireSuperuser();

  const teamDelegate = prisma.team;
  const resolvedSearchParams = await searchParams;
  const search = String(resolvedSearchParams?.search || "").trim();
  const page = Math.max(Number(resolvedSearchParams?.page || 1) || 1, 1);
  const where = await buildSearchFilter(search);
  const teamMemberDelegate = prisma.teamMember;

  if (!teamDelegate?.findMany || !teamMemberDelegate?.findMany) {
    return (
      <TeamManagementClient
        teams={[]}
        leaderCandidates={[]}
        memberCandidates={[]}
        teamUsage={[]}
        search={search}
        pagination={{
          currentPage: 1,
          totalPages: 1,
          totalTeams: 0,
          pageSize: PAGE_SIZE,
        }}
        initError="Model team belum siap di Prisma Client. Jalankan: npm run prisma:generate && npm run prisma:push"
      />
    );
  }

  const totalTeams = await teamDelegate.count({ where });
  const totalPages = Math.max(Math.ceil(totalTeams / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);

  const [teams, leaderCandidates, memberCandidates, teamUsage] = await Promise.all([
    teamDelegate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        leaderId: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: TEAM_LEADER_ROLE,
      },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: {
          not: "SUPERUSER",
        },
      },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    }),
    prisma.team.findMany({
      select: {
        id: true,
        leaderId: true,
      },
    }),
  ]);

  const [pageTeamMembers, allTeamMembers] = await Promise.all([
    teamMemberDelegate.findMany({
      where: {
        teamId: {
          in: teams.map((team) => team.id),
        },
      },
      select: {
        teamId: true,
        userId: true,
      },
    }),
    teamMemberDelegate.findMany({
      select: {
        teamId: true,
        userId: true,
      },
    }),
  ]);

  const userIdsNeeded = Array.from(
    new Set([
      ...leaderCandidates.map((user) => user.id),
      ...memberCandidates.map((user) => user.id),
      ...teams.map((team) => team.leaderId),
      ...pageTeamMembers.map((member) => member.userId),
    ])
  );

  const usersForMap = await prisma.user.findMany({
    where: {
      id: {
        in: userIdsNeeded,
      },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  });

  const userMap = new Map(usersForMap.map((user) => [user.id, user]));

  const pageMembersByTeamId = pageTeamMembers.reduce((accumulator, member) => {
    if (!accumulator.has(member.teamId)) {
      accumulator.set(member.teamId, []);
    }

    const user = userMap.get(member.userId);
    if (user) {
      accumulator.get(member.teamId).push({
        userId: member.userId,
        user,
      });
    }

    return accumulator;
  }, new Map());

  const normalizedTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    leaderId: team.leaderId,
    leader: userMap.get(team.leaderId) || {
      id: team.leaderId,
      email: "-",
      fullName: null,
      role: TEAM_LEADER_ROLE,
    },
    members: pageMembersByTeamId.get(team.id) || [],
  }));

  const allMembersByTeamId = allTeamMembers.reduce((accumulator, member) => {
    if (!accumulator.has(member.teamId)) {
      accumulator.set(member.teamId, []);
    }

    accumulator.get(member.teamId).push({ userId: member.userId });
    return accumulator;
  }, new Map());

  const normalizedTeamUsage = teamUsage.map((team) => ({
    id: team.id,
    leaderId: team.leaderId,
    members: allMembersByTeamId.get(team.id) || [],
  }));

  return (
    <TeamManagementClient
      teams={normalizedTeams}
      leaderCandidates={leaderCandidates}
      memberCandidates={memberCandidates}
      teamUsage={normalizedTeamUsage}
      search={search}
      pagination={{
        currentPage,
        totalPages,
        totalTeams,
        pageSize: PAGE_SIZE,
      }}
    />
  );
}
