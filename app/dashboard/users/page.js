import UsersCrudClient from "@/app/dashboard/users/users-crud-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getRolePriority, getRolePriorityMap } from "@/lib/role-priority";

export const metadata = {
  title: "Users",
  description: "CRUD user management",
};

const PAGE_SIZE = 10;

function buildSearchFilter(search) {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { email: { contains: search } },
      { fullName: { contains: search } },
      { birthPlace: { contains: search } },
      { address: { contains: search } },
      { role: { contains: search } },
    ],
  };
}

export default async function UsersPage({ searchParams }) {
  const { session, evaluator } = await requirePagePermission("users", "view");

  const resolvedSearchParams = await searchParams;
  const search = String(resolvedSearchParams?.search || "").trim();
  const page = Math.max(Number(resolvedSearchParams?.page || 1) || 1, 1);
  const where = buildSearchFilter(search);
  const rolePriorityMap = await getRolePriorityMap();
  const viewerPriority = getRolePriority(rolePriorityMap, session.user.role);

  const totalUsers = await prisma.user.count({ where });
  const totalPages = Math.max(Math.ceil(totalUsers / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);

  const [users, roleEntries] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        fullName: true,
        birthPlace: true,
        birthDate: true,
        address: true,
        role: true,
        createdAt: true,
        userDocument: {
          select: {
            ktpPath: true,
            ktpName: true,
            kkPath: true,
            kkName: true,
            ijazahPath: true,
            ijazahName: true,
            skckPath: true,
            skckName: true,
          },
        },
      },
    }),
    prisma.roleEntry.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const usersWithPriority = users.map((user) => ({
    ...user,
    priority: getRolePriority(rolePriorityMap, user.role),
  }));

  const roleOptions = roleEntries
    .map((role) => role.name)
    .filter((roleName) => getRolePriority(rolePriorityMap, roleName) <= viewerPriority);

  return (
    <UsersCrudClient
      users={usersWithPriority}
      roleOptions={roleOptions}
      viewerPriority={viewerPriority}
      canCreate={evaluator.canCrud("users", "create")}
      canUpdate={evaluator.canCrud("users", "update")}
      canDelete={evaluator.canCrud("users", "delete")}
      pagination={{
        currentPage,
        totalPages,
        totalUsers,
        pageSize: PAGE_SIZE,
      }}
      search={search}
    />
  );
}
