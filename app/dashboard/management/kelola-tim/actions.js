"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TEAM_LEADER_ROLE } from "@/app/dashboard/management/kelola-tim/constants";

function ensureTeamDelegate() {
  const teamDelegate = prisma.team;

  if (!teamDelegate) {
    return {
      error: "Model team belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  return { teamDelegate };
}

function parseMemberIds(formData) {
  return Array.from(new Set(formData.getAll("memberIds").map((value) => String(value || "").trim()).filter(Boolean)));
}

function buildNotCurrentTeamFilter(teamId) {
  if (!teamId) {
    return {};
  }

  return {
    NOT: {
      id: teamId,
    },
  };
}

function buildNotCurrentTeamMemberFilter(teamId) {
  if (!teamId) {
    return {};
  }

  return {
    teamId: {
      not: teamId,
    },
  };
}

async function validateTeamInput({ name, leaderId, memberIds, teamId }) {
  if (!name) {
    return { error: "Nama tim wajib diisi." };
  }

  if (!leaderId) {
    return { error: "Leader tim wajib dipilih." };
  }

  if (memberIds.length === 0) {
    return { error: "Anggota tim wajib dipilih minimal 1 user." };
  }

  if (memberIds.includes(leaderId)) {
    return { error: "Leader tim tidak boleh dipilih sebagai anggota tim." };
  }

  const [duplicateTeamName, leaderUser, leaderAlreadyUsed, leaderAlreadyMemberElsewhere, selectedMembers, conflictingUsers] = await Promise.all([
    prisma.team.findFirst({
      where: {
        name,
        ...buildNotCurrentTeamFilter(teamId),
      },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: leaderId },
      select: { id: true, role: true },
    }),
    prisma.team.findFirst({
      where: {
        leaderId,
        ...buildNotCurrentTeamFilter(teamId),
      },
      select: { id: true },
    }),
    prisma.teamMember.findFirst({
      where: {
        userId: leaderId,
        ...buildNotCurrentTeamMemberFilter(teamId),
      },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: {
        id: { in: memberIds },
      },
      select: {
        id: true,
        role: true,
      },
    }),
    prisma.$transaction([
      prisma.team.findMany({
        where: {
          leaderId: { in: memberIds },
          ...buildNotCurrentTeamFilter(teamId),
        },
        select: { leaderId: true },
      }),
      prisma.teamMember.findMany({
        where: {
          userId: { in: memberIds },
          ...buildNotCurrentTeamMemberFilter(teamId),
        },
        select: { userId: true },
      }),
    ]),
  ]);

  if (duplicateTeamName) {
    return { error: "Nama tim sudah digunakan." };
  }

  if (!leaderUser) {
    return { error: "User leader tidak ditemukan." };
  }

  if (leaderUser.role !== TEAM_LEADER_ROLE) {
    return { error: `Leader harus memiliki role ${TEAM_LEADER_ROLE}.` };
  }

  if (leaderAlreadyUsed || leaderAlreadyMemberElsewhere) {
    return { error: "User leader sudah dipakai di tim lain." };
  }

  if (selectedMembers.length !== memberIds.length) {
    return { error: "Ada anggota tim yang tidak valid." };
  }

  if (selectedMembers.some((member) => member.role === "SUPERUSER")) {
    return { error: "SUPERUSER tidak boleh dijadikan anggota tim." };
  }

  const [membersAsLeaderElsewhere, membersAsMemberElsewhere] = conflictingUsers;

  if (membersAsLeaderElsewhere.length > 0 || membersAsMemberElsewhere.length > 0) {
    return { error: "Sebagian user sudah dipakai di tim lain." };
  }

  return { success: true };
}

export async function createTeamAction(formData) {
  await requirePagePermission("management-teams", "create");

  const delegate = ensureTeamDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const name = String(formData.get("name") || "").trim();
  const leaderId = String(formData.get("leaderId") || "").trim();
  const memberIds = parseMemberIds(formData);

  const validation = await validateTeamInput({
    name,
    leaderId,
    memberIds,
  });

  if (validation.error) {
    return { error: validation.error };
  }

  await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name,
        leaderId,
      },
    });

    await tx.teamMember.createMany({
      data: memberIds.map((userId) => ({
        teamId: team.id,
        userId,
      })),
    });
  });

  revalidatePath("/dashboard/management/kelola-tim");
  return { success: true };
}

export async function updateTeamAction(formData) {
  await requirePagePermission("management-teams", "update");

  const delegate = ensureTeamDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const leaderId = String(formData.get("leaderId") || "").trim();
  const memberIds = parseMemberIds(formData);

  if (!id) {
    return { error: "ID tim tidak valid." };
  }

  const existingTeam = await delegate.teamDelegate.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingTeam) {
    return { error: "Tim tidak ditemukan." };
  }

  const validation = await validateTeamInput({
    name,
    leaderId,
    memberIds,
    teamId: id,
  });

  if (validation.error) {
    return { error: validation.error };
  }

  await prisma.$transaction(async (tx) => {
    await tx.team.update({
      where: { id },
      data: {
        name,
        leaderId,
      },
    });

    await tx.teamMember.deleteMany({
      where: { teamId: id },
    });

    await tx.teamMember.createMany({
      data: memberIds.map((userId) => ({
        teamId: id,
        userId,
      })),
    });
  });

  revalidatePath("/dashboard/management/kelola-tim");
  return { success: true };
}

export async function deleteTeamAction(formData) {
  await requirePagePermission("management-teams", "delete");

  const delegate = ensureTeamDelegate();
  if (delegate.error) {
    return { error: delegate.error };
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    return { error: "ID tim tidak valid." };
  }

  await delegate.teamDelegate.delete({ where: { id } });

  revalidatePath("/dashboard/management/kelola-tim");
  return { success: true };
}
