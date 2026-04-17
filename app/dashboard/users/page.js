import UsersCrudClient from "@/app/dashboard/users/users-crud-client";
import { requireSuperuser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  await requireSuperuser();

  const resolvedSearchParams = await searchParams;
  const search = String(resolvedSearchParams?.search || "").trim();
  const page = Math.max(Number(resolvedSearchParams?.page || 1) || 1, 1);
  const where = buildSearchFilter(search);

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

  const roleOptions = roleEntries.map((role) => role.name);

  return (
    <UsersCrudClient
      users={users}
      roleOptions={roleOptions}
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
